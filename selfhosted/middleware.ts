import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ==========================================================================
 * 自托管版中间件：只做「把当前 pathname 透传给服务端组件」这一件事。
 *
 * 历史教训（重要，别再改回去）：
 * 这里曾经用「middleware 自己 HTTP 请求 /api/install」来判断安装状态。
 * middleware 跑在 edge 沙箱里，在 Nginx 反代 / 隧道这类部署下这个自探会失败，
 * 而失败被当成「未安装」，于是：
 *   · 装好的站点被整站 307 到 /install —— 首页打不开，整站等于砖掉；
 *   · 安装向导长期对外暴露，任何人都能打开重装表单（严重安全风险）。
 *
 * 现在安装状态全部下沉到 Node 运行时的 lib/install-lock.ts
 * （环境变量硬锁 → 安装标记文件 → users 表），判定结果与真实数据库一致：
 *   · app/layout.tsx：未安装时把访客引导到 /install（靠这里的 x-pathname 判断当前路径）
 *   · app/install/page.tsx：已安装则 404
 *   · app/api/install/route.ts：已安装则拒绝安装
 * ========================================================================== */

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // 排除 _next 静态资源与 favicon，其余请求都过中间件
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
