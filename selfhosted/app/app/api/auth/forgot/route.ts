import { NextRequest, NextResponse } from "next/server";
import { getMasterKey } from "@/lib/auth";
import { findUserByEmail, issueResetToken, RESET_MINUTES } from "@/lib/users";
import { safeEqual } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    masterKey?: string;
  };

  const email = (body.email ?? "").trim();
  const masterKey = (body.masterKey ?? "").trim();

  if (!email || !masterKey) {
    return NextResponse.json(
      { error: "请填写注册邮箱与找回密钥" },
      { status: 400 }
    );
  }

  // 找回密钥 = 管理员密码（环境变量 ADMIN_PASSWORD），只有站主本人知道
  const master = await getMasterKey();
  if (!safeEqual(masterKey, master)) {
    return NextResponse.json({ error: "找回密钥不正确" }, { status: 401 });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "该邮箱尚未注册" }, { status: 404 });
    }

    const token = await issueResetToken(user.id);
    return NextResponse.json({
      ok: true,
      token,
      expiresInMinutes: RESET_MINUTES,
      email: user.email,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `操作失败：${msg}` }, { status: 500 });
  }
}
