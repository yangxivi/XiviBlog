import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 未安装时，把站点页面请求重定向到 /install 安装向导（WordPress 式体验）。
// 安装状态带 30s 内存缓存，避免每次请求都打 DB。
let cache: { installed: boolean; ts: number } | null = null;
const TTL = 30_000;

async function isInstalled(req: NextRequest): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) return cache.installed;
  try {
    const url = new URL("/api/install", req.url);
    const r = await fetch(url, { cache: "no-store" });
    const d = (await r.json()) as { installed?: boolean };
    const installed = !!(d && d.installed);
    cache = { installed, ts: now };
    return installed;
  } catch {
    // 无法判定时按「未安装」处理，导向安装页
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 安装向导、鉴权、静态资源、图片目录等一律放行
  if (
    pathname === "/install" ||
    pathname.startsWith("/api/install") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/shots") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  if (/\.(png|jpe?g|gif|svg|ico|css|js|woff2?|ttf|webp|json|txt|xml|webmanifest)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const installed = await isInstalled(req);
  if (!installed) {
    const url = req.nextUrl.clone();
    url.pathname = "/install";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // 排除 _next 静态资源与 favicon，其余请求都过中间件
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
