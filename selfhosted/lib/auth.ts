import { cookies } from "next/headers";
import { toHex, safeEqual, verifyPassword } from "./password";
import { findUserById, findUserByEmail, type PublicUser, toPublicUser } from "./users";

const COOKIE_NAME = "xivi_session";
const SESSION_HOURS = 24 * 7; // 默认 7 天
const SESSION_HOURS_REMEMBER = 24 * 30; // 勾选「记住我」30 天

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return toHex(sig);
}

/** 读取环境变量（自托管：直接读 process.env） */
export async function getEnv(): Promise<Record<string, string>> {
  return process.env as unknown as Record<string, string>;
}

async function getSecret(): Promise<string> {
  const e = await getEnv();
  return (
    (e.SESSION_SECRET || e.ADMIN_PASSWORD + "_xivi_fallback") ||
    "xivi-dev-secret"
  );
}

/** 主密钥：用于「忘记密码」时验证身份，以及作为注册邀请码 */
export async function getMasterKey(): Promise<string> {
  const e = await getEnv();
  // 默认占位符（仅本地未配置时使用）；生产务必通过 ADMIN_PASSWORD 环境变量设置
  return e.ADMIN_PASSWORD || "change-me-master-key";
}

export async function createSessionToken(
  userId: number,
  remember = false
): Promise<{ token: string; maxAge: number }> {
  const secret = await getSecret();
  const hours = remember ? SESSION_HOURS_REMEMBER : SESSION_HOURS;
  const exp = Date.now() + hours * 3600 * 1000;
  const payload = `u${userId}.${exp}`;
  const sig = await hmac(payload, secret);
  return { token: `${payload}.${sig}`, maxAge: hours * 3600 };
}

/** 校验会话，返回用户 id；0 表示旧版兼容会话（无具体用户） */
export async function readSession(
  token: string | undefined
): Promise<number | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [role, expStr, sig] = parts;
  if (!expStr || !sig) return null;

  const match = /^u(\d+)$/.exec(role);
  let userId: number;
  if (match) userId = Number(match[1]);
  else if (role === "admin") userId = 0; // 兼容旧 cookie
  else return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  const expect = await hmac(`${role}.${expStr}`, await getSecret());
  return safeEqual(sig, expect) ? userId : null;
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const jar = await cookies();
    return (await readSession(jar.get(COOKIE_NAME)?.value)) !== null;
  } catch {
    // 非请求上下文（如构建期预渲染 /_global-error、/_not-found）无 cookie 可读，
    // 按未登录处理即可，不影响真实请求里的鉴权。
    return false;
  }
}

/** 当前登录用户（旧版兼容会话返回 null） */
export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const jar = await cookies();
    const userId = await readSession(jar.get(COOKIE_NAME)?.value);
    if (!userId) return null;
    const user = await findUserById(userId);
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

/** 账号密码校验（登录用） */
export async function checkCredentials(
  email: string,
  password: string
): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.pass_hash, user.pass_salt);
  return ok ? toPublicUser(user) : null;
}

/**
 * 是否通过 HTTPS 访问。
 * 自托管用户可能用纯 HTTP（未配反代/证书）访问，此时若把 Cookie 标 secure，
 * 浏览器会拒绝存储会话 Cookie，导致后台登录态无法保持。
 * 因此 secure 必须按真实协议自适应：仅当确为 HTTPS（直连或经反向代理 X-Forwarded-Proto）时才置 true。
 */
export function isHttps(req: import("next/server").NextRequest): boolean {
  if (req.nextUrl.protocol === "https:") return true;
  const fwd = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  return fwd === "https";
}

export function cookieOptions(maxAge: number, secure = true) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge,
    path: "/",
  };
}

export { COOKIE_NAME, SESSION_HOURS, SESSION_HOURS_REMEMBER };
