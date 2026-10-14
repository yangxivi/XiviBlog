import { NextResponse } from "next/server";
import {
  getCurrentUser,
  readSession,
  cookieOptions,
  COOKIE_NAME,
  createSessionToken,
} from "@/lib/auth";
import {
  findUserById,
  updatePassword,
  updateProfile,
  toPublicUser,
  type UserRow,
} from "@/lib/users";
import { verifyPassword } from "@/lib/password";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const MIN_LEN = 8;
const MAX_LEN = 128;
const NAME_MAX = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 密码强度：长度 + 至少包含字母与数字 */
function strongEnough(pw: string): boolean {
  return pw.length >= MIN_LEN && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/** 解析登录者 + 用户行；未登录/兼容会话返回错误（用 ok 做判别字段，便于 TS 收窄） */
async function requireUser(): Promise<
  | { ok: false; error: { status: number; message: string } }
  | { ok: true; me: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; row: UserRow }
> {
  const jar = await cookies();
  const userId = await readSession(jar.get(COOKIE_NAME)?.value);
  if (!userId) {
    return { ok: false, error: { status: 401, message: "未登录或会话已过期" } };
  }
  // 旧版兼容会话（userId=0）没有具体用户，拒绝操作
  if (userId === 0) {
    return {
      ok: false,
      error: { status: 400, message: "当前为兼容会话，请重新登录后再试" },
    };
  }

  const me = await getCurrentUser();
  if (!me) {
    return { ok: false, error: { status: 401, message: "未登录或会话已过期" } };
  }

  const row = await findUserById(me.id);
  if (!row) return { ok: false, error: { status: 404, message: "用户不存在" } };

  return { ok: true, me, row };
}

/** 读取当前账号资料 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error.message },
        { status: auth.error.status }
      );
    }
    return NextResponse.json({ user: auth.me });
  } catch {
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}

/**
 * 修改当前登录管理员的账号资料 / 密码。
 * action=profile → 改用户名、邮箱（无需当前密码）
 * action=password → 仅改密码（必须校验当前密码，防会话劫持）
 * action=both     → 同时改（仍需当前密码）
 * 成功后轮换会话 Cookie。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error.message },
        { status: auth.error.status }
      );
    }
    const { me, row } = auth;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const {
      action = "password",
      name,
      email,
      currentPassword,
      newPassword,
      confirmPassword,
    } = (body || {}) as {
      action?: string;
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const wantProfile = action === "profile" || action === "both";
    const wantPassword = action === "password" || action === "both";

    if (!wantProfile && !wantPassword) {
      return NextResponse.json({ error: "未知的操作类型" }, { status: 400 });
    }

    // ---------- 改账号资料 ----------
    if (wantProfile) {
      const newName = typeof name === "string" ? name.trim() : "";
      const newEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

      if (!newName) {
        return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
      }
      if (newName.length > NAME_MAX) {
        return NextResponse.json(
          { error: `用户名过长（最多 ${NAME_MAX} 字符）` },
          { status: 400 }
        );
      }
      if (!EMAIL_RE.test(newEmail)) {
        return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
      }

      try {
        await updateProfile(me.id, { name: newName, email: newEmail });
      } catch (e) {
        if (e instanceof Error && e.message === "EMAIL_TAKEN") {
          return NextResponse.json(
            { error: "该邮箱已被其他账号使用" },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
      }
    }

    // ---------- 改密码 ----------
    if (wantPassword) {
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

      // 关键校验：用当前密码确认身份
      const ok = await verifyPassword(currentPassword, row.pass_hash, row.pass_salt);
      if (!ok) {
        return NextResponse.json({ error: "当前密码不正确" }, { status: 403 });
      }

      await updatePassword(me.id, newPassword);
    }

    // 轮换会话 Cookie，避免旧 token 残留
    const { token, maxAge } = await createSessionToken(me.id);
    const jar = await cookies();
    jar.set(COOKIE_NAME, token, cookieOptions(maxAge));

    const fresh = await findUserById(me.id);
    return NextResponse.json({
      ok: true,
      message:
        wantProfile && wantPassword
          ? "账号资料与密码已更新"
          : wantProfile
            ? "账号资料已更新"
            : "密码修改成功",
      user: fresh ? toPublicUser(fresh) : null,
    });
  } catch {
    return NextResponse.json({ error: "操作失败，请稍后重试" }, { status: 500 });
  }
}