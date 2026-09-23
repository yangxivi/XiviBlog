/**
 * 密码哈希：PBKDF2-HMAC-SHA256（Web Crypto，Workers 原生支持，零依赖）
 *
 * 存储格式（分两列）：
 *   pass_hash = 16 进制摘要
 *   pass_salt = 16 进制随机盐
 */

const ITERATIONS = 100_000;
const KEY_BYTES = 32; // 256 bit
const SALT_BYTES = 16;

export function toHex(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BYTES * 8
  );
  return toHex(bits);
}

/** 生成新的密码哈希与盐 */
export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return { hash: await derive(password, salt), salt: toHex(salt) };
}

/** 常数时间比较，防止时序侧信道 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 校验密码 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  if (!hash || !salt) return false;
  const got = await derive(password, fromHex(salt));
  return safeEqual(got, hash);
}

/** 生成随机 token（用于密码重置） */
export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}
