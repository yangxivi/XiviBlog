import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  COOKIE_NAME,
  cookieOptions,
  getMasterKey,
} from "@/lib/auth";
import {
  createUser,
  findUserByEmail,
  normalizeEmail,
  toPublicUser,
  findUserById,
} from "@/lib/users";
import { safeEqual } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
    code?: string;
  };

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const code = (body.code ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  // 邀请码校验（默认即管理员密码，可在 CF 控制台改 ADMIN_PASSWORD）
  const master = await getMasterKey();
  if (!safeEqual(code, master)) {
    return NextResponse.json(
      { error: "注册邀请码不正确" },
      { status: 403 }
    );
  }

  try {
    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    const id = await createUser({
      email,
      name: (body.name ?? "").trim() || "管理员",
      password,
    });
    const row = await findUserById(id);
    if (!row) throw new Error("账号创建后读取失败");

    const { token, maxAge } = await createSessionToken(id, true);
    const res = NextResponse.json({ ok: true, user: toPublicUser(row) });
    res.cookies.set(COOKIE_NAME, token, cookieOptions(maxAge));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `注册失败：${msg}` }, { status: 500 });
  }
}
