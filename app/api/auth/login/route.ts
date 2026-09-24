import { NextRequest, NextResponse } from "next/server";
import {
  checkCredentials,
  createSessionToken,
  COOKIE_NAME,
  cookieOptions,
} from "@/lib/auth";
import { touchLogin } from "@/lib/users";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    remember?: boolean;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }

  try {
    const user = await checkCredentials(email, password);
    if (!user) {
      return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
    }

    await touchLogin(user.id);
    const { token, maxAge } = await createSessionToken(user.id, !!body.remember);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(COOKIE_NAME, token, cookieOptions(maxAge));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `登录失败：${msg}`, hint: "数据表可能尚未初始化" },
      { status: 500 }
    );
  }
}
