/**
 * 兼容路由：旧版「修改密码」端点。
 * 已升级为「账号管理」，逻辑统一收敛到 /api/auth/account，
 * 此处仅做转发，保证旧调用方（如已缓存的前端）不 404。
 */
import { POST as accountPost } from "../account/route";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 兼容：旧调用不传 action，默认按改密码处理
  const clone = req.clone();
  let body: Record<string, unknown> = {};
  try {
    body = (await clone.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!body.action) body.action = "password";

  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");

  return accountPost(
    new Request(req.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  );
}