import { NextResponse } from "next/server";
import { getCurrentUser, readSession, cookieOptions, COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { findUserById, updatePassword } from "@/lib/users";
import { verifyPassword } from "@/lib/password";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const MIN_LEN = 8;
const MAX_LEN = 128;

/** 密码强度：长度 + 至少包含字母与数字 */
function strongEnough(pw: string): boolean {
  return pw.length >= MIN_LEN && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/**
 * 修改当前登录管理员的密码。
 * 必须校验「当前密码」，避免会话被劫持后直接改密。
 * 改密成功后轮换会话 Cookie，并让其它已登录会话失效（口令已变）。
 */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const userId = await readSession(jar.get(COOKIE_NAME)?.value);
    if (!userId) {
      return NextResponse.json({ error: "未登录或会话已过期" }, { status: 401 });
    }

    // 旧版兼容会话（userId=0）没有具体用户，拒绝改密
    if (userId === 0) {
      return NextResponse.json(
        { error: "当前为兼容会话，无法修改密码，请重新登录后再试" },
        { status: 400 }
      );
    }

    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "未登录或会话已过期" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const { currentPassword, newPassword, confirmPassword } = (body || {}) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "请输入当前密码" }, { status: 400 });
    }
    if (typeof newPassword !== "string" || !newPassword) {
      return NextResponse.json({ error: "请输入新密码" }, { status: 400 });
    }
    if (newPassword.length > MAX_LEN) {
      return NextResponse.json(
        { error: `新密码过长（最多 ${MAX_LEN} 位）` },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "两次输入的新密码不一致" }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 });
    }
    if (!strongEnough(newPassword)) {
      return NextResponse.json(
        { error: `密码强度不足：至少 ${MIN_LEN} 位，且需同时包含字母和数字` },
        { status: 400 }
      );
    }

    const user = await findUserById(me.id);
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 关键校验：用当前密码确认身份
    const ok = await verifyPassword(currentPassword, user.pass_hash, user.pass_salt);
    if (!ok) {
      return NextResponse.json({ error: "当前密码不正确" }, { status: 403 });
    }

    await updatePassword(me.id, newPassword);

    // 轮换会话 Cookie，避免旧 token 残留
    const { token, maxAge } = await createSessionToken(me.id);
    const jarCookies = await cookies();
    jarCookies.set(COOKIE_NAME, token, cookieOptions(maxAge));

    return NextResponse.json({ ok: true, message: "密码修改成功" });
  } catch {
    return NextResponse.json({ error: "修改失败，请稍后重试" }, { status: 500 });
  }
}