import { getDB } from "./db";
import { hashPassword, randomToken } from "./password";

export type UserRow = {
  id: number;
  email: string;
  name: string;
  pass_hash: string;
  pass_salt: string;
  role: string;
  created_at: string;
  last_login_at: string;
  reset_token: string;
  reset_expires: number;
};

export type PublicUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_login_at: string;
};

const RESET_MINUTES = 30;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}

export async function countUsers(): Promise<number> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM users")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM users WHERE email=?1")
    .bind(normalizeEmail(email))
    .first<UserRow>();
  return row ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM users WHERE id=?1")
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

export async function listUsers(): Promise<PublicUser[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT id, email, name, role, created_at, last_login_at FROM users ORDER BY id ASC"
    )
    .all<PublicUser>();
  return results ?? [];
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role?: string;
}): Promise<number> {
  const db = await getDB();
  const { hash, salt } = await hashPassword(input.password);
  const r = await db
    .prepare(
      "INSERT INTO users (email, name, pass_hash, pass_salt, role) VALUES (?1,?2,?3,?4,?5)"
    )
    .bind(
      normalizeEmail(input.email),
      input.name.trim() || "管理员",
      hash,
      salt,
      input.role || "admin"
    )
    .run();
  return Number(r.meta.last_row_id ?? 0);
}

export async function updatePassword(
  userId: number,
  password: string
): Promise<void> {
  const db = await getDB();
  const { hash, salt } = await hashPassword(password);
  await db
    .prepare(
      "UPDATE users SET pass_hash=?1, pass_salt=?2, reset_token='', reset_expires=0 WHERE id=?3"
    )
    .bind(hash, salt, userId)
    .run();
}

export async function touchLogin(userId: number): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?1")
    .bind(userId)
    .run();
}

/** 生成一次性重置 token（30 分钟有效），返回 token 明文 */
export async function issueResetToken(userId: number): Promise<string> {
  const db = await getDB();
  const token = randomToken(32);
  const expires = Date.now() + RESET_MINUTES * 60 * 1000;
  await db
    .prepare("UPDATE users SET reset_token=?1, reset_expires=?2 WHERE id=?3")
    .bind(token, expires, userId)
    .run();
  return token;
}

export async function findByResetToken(token: string): Promise<UserRow | null> {
  if (!token || token.length < 16) return null;
  const db = await getDB();
  const row = await db
    .prepare(
      "SELECT * FROM users WHERE reset_token=?1 AND reset_expires > ?2"
    )
    .bind(token, Date.now())
    .first<UserRow>();
  return row ?? null;
}

export async function clearResetToken(userId: number): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE users SET reset_token='', reset_expires=0 WHERE id=?1")
    .bind(userId)
    .run();
}

export { RESET_MINUTES };
