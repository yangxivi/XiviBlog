import { NextRequest, NextResponse } from "next/server";
import { findByResetToken, updatePassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };

  const token = (body.token ?? "").trim();
  const password = body.password ?? "";

  if (!token) {
    return NextResponse.json({ error: "重置链接无效" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  try {
    const user = await findByResetToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "重置链接已失效或已使用，请重新获取" },
        { status: 400 }
      );
    }
    await updatePassword(user.id, password);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `重置失败：${msg}` }, { status: 500 });
  }
}
