import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 未安装时，把站点页面请求重定向到 /install 安装向导（WordPress 式体验）。
// 安装状态带短周期内存缓存，避免每次请求都打 DB；TTL 要短，
// 否则「刚装完的用户访问首页会被缓存里的未安装状态弹回安装页」。
let cache: { installed: boolean; ts: number } | null = null;
const TTL = 3_000;

// middleware 自身通过 HTTP 自探安装状态；给探针请求打上私有头，
// middleware 对带此头的请求直接放行，避免「探针 → middleware → 再探针」递归。
const PROBE_HEADER = "x-install-probe";

async function isInstalled(req: NextRequest): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) return cache.installed;
  try {
    const url = new URL("/api/install", req.url);
    const r = await fetch(url, {
      cache: "no-store",
      headers: { [PROBE_HEADER]: "1" },
    });
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

  // 自身发出的安装状态探针：直接放行
  if (req.headers.get(PROBE_HEADER) === "1") {
    return NextResponse.next();
  }

  // 安装向导（页面 + API）：仅未安装时可用；装完自动关闭，
  // 防止已上线站点被任何人重开向导覆盖安装。
  if (pathname === "/install" || pathname.startsWith("/api/install")) {
    const installed = await isInstalled(req);
    if (!installed) return NextResponse.next();
    if (pathname.startsWith("/api/install")) {
      return NextResponse.json(
        {
          error:
            "博客已安装，安装向导已自动关闭。如需重装请清空数据库文件后重启服务。",
          installed: true,
        },
        { status: 409 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 鉴权、静态资源、图片目录等一律放行
  if (
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
