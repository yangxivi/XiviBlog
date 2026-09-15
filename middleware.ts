import { NextRequest, NextResponse } from "next/server";

/**
 * 强制 HTTPS 兜底。
 *
 * 为什么需要：登录用的是 `Secure` 会话 Cookie，浏览器只在 HTTPS 下保存它。
 * 如果访客通过 http:// 打开站点，登录接口本身会返回 200（密码校验通过），
 * 但 Cookie 被浏览器静默丢弃，于是「闪一下又退回登录页」。
 *
 * Cloudflare 侧已开启 Always Use HTTPS，这里再加一层应用级兜底，
 * 避免哪天设置被关掉后又出现同样的玄学问题。
 */
export function middleware(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  const res = NextResponse.next();

  // 前台公开页面做 CDN 边缘缓存：60s 内直接命中 Cloudflare 边缘，
  // 过期后用 stale-while-revalidate 在后台静默刷新，访客永远拿到瞬时响应。
  // 后台 /admin 与接口 /api 不参与缓存（含登录态、写入、个性化数据）。
  // 注意：真正的边缘缓存由 custom-worker.ts 用 Cache API 实现（只写 Cache-Control
  // 头对 Worker 返回的 HTML 无效）；这里负责给出正确的缓存指令。
  const { pathname } = req.nextUrl;
  const hasSession = (req.headers.get("cookie") || "").includes("xivi_session");
  const isPublic =
    req.method === "GET" && !pathname.startsWith("/admin") && !pathname.startsWith("/api");

  if (isPublic && !hasSession) {
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=600"
    );
  } else if (isPublic && hasSession) {
    // 登录态访问前台：页面里有「编辑」入口等个性化内容，禁止任何共享缓存
    res.headers.set("Cache-Control", "private, no-store");
  }
  return res;
}

export const config = {
  // 静态资源与图片优化请求不必过这层
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
