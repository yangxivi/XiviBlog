// @ts-nocheck
/**
 * 自定义 Worker 入口（在 OpenNext 生成的 fetch handler 前面加一层边缘缓存）。
 *
 * 为什么需要：
 *  本站所有前台页面都是 `force-dynamic`，OpenNext 生成的 Worker 对每个请求都现场
 *  查 D1 + 渲染；实测线上 TTFB 1.0~2.6s，而同一站点的静态资源 TTFB 只有 ~280ms，
 *  说明耗时几乎全在服务端渲染。仅在响应上写 `Cache-Control` 头**不会**让 Cloudflare
 *  缓存 Worker 返回的 HTML（实测响应里根本没有 cf-cache-status），必须显式使用 Cache API。
 *
 * 缓存三类内容（各自独立缓存 key）：
 *  1. html —— 匿名访客的整页 GET，首屏 TTFB 从 1~2.6s 降到 ~0.3s
 *  2. rsc  —— 客户端路由跳转的 flight 数据，让「每次点击」也能命中边缘缓存
 *  3. json —— /api/posts 的分页读取（?page=/?size=），公共数据
 *
 * 安全边界：
 *  - 带登录 Cookie（xivi_session）的请求一律不读不写缓存 —— 页面里「编辑」入口等
 *    个性化内容依赖登录态，缓存会造成内容串味。
 *  - /admin、/_next、其余 /api、静态后缀一律直通。
 *  - 任何一步异常都直接回落原始 handler，缓存层永远不会让站点不可用。
 *
 * 上线后如需调整缓存时长，只改 EDGE_TTL 即可。
 */
import handler from "./.open-next/worker.js";

/** 边缘缓存时长（秒）。内容更新最迟这么多秒后全量可见。 */
const EDGE_TTL = 60;

/** 存入/返回边缘缓存时统一使用的缓存指令：边缘缓存 60s，浏览器每次回源校验。 */
const EDGE_CACHE_CONTROL = `public, max-age=0, s-maxage=${EDGE_TTL}, stale-while-revalidate=600`;

const BYPASS_PREFIXES = ["/admin", "/_next"];
const BYPASS_SUFFIXES = [".ico", ".txt", ".xml", ".webmanifest", ".png", ".jpg", ".svg", ".webp"];

/** 判断请求属于哪一类可缓存内容，返回 "html" | "rsc" | "json" | null */
function classify(req, url) {
  if (req.method !== "GET") return null;

  // 登录态个性化内容不缓存（站长看到的「编辑」入口不能被缓存后发给访客）
  const cookie = req.headers.get("cookie") || "";
  if (cookie.includes("xivi_session")) return null;

  // 分页读取的公共 JSON（?page= / ?size=）；?id= / ?slug= / ?scope=all 需登录，不缓存
  if (url.pathname === "/api/posts") {
    return url.searchParams.has("page") || url.searchParams.has("size") ? "json" : null;
  }
  if (url.pathname.startsWith("/api")) return null;

  const path = url.pathname;
  if (BYPASS_PREFIXES.some((p) => path.startsWith(p))) return null;
  if (BYPASS_SUFFIXES.some((s) => path.endsWith(s))) return null;

  // 客户端路由跳转 / 预取的 flight 数据（rsc=1）：缓存它，「点击」才快
  if (req.headers.get("rsc") === "1") return "rsc";
  if (req.headers.get("next-router-prefetch")) return null;
  if ((req.headers.get("purpose") || "").toLowerCase().includes("prefetch")) return null;

  // 整页文档请求
  const accept = req.headers.get("accept") || "";
  if (accept && !accept.includes("text/html")) return null;

  return "html";
}

/** 校验响应确实是对应类型，避免把错误页 / 空响应当成内容缓存起来 */
function matchesKind(res, kind) {
  if (res.status !== 200) return false;
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (kind === "html") return type.includes("text/html");
  if (kind === "json") return type.includes("application/json");
  return type.includes("text/x-component") || type.includes("text/plain");
}

async function handleWithEdgeCache(req, env, ctx) {
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return handler.fetch(req, env, ctx);
  }

  const kind = classify(req, url);
  if (!kind) return handler.fetch(req, env, ctx);

  let cache;
  try {
    cache = typeof caches !== "undefined" ? caches.default : undefined;
  } catch {
    cache = undefined;
  }
  if (!cache) return handler.fetch(req, env, ctx);

  // 三类内容用同一个 URL 但是不同的响应体，靠 __v 参数区分缓存条目
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", kind);
  const key = new Request(keyUrl.toString(), { method: "GET" });

  // 1) 读缓存
  try {
    const hit = await cache.match(key);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("Cache-Control", EDGE_CACHE_CONTROL);
      headers.set("x-edge-cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  } catch {
    /* 读缓存失败当作未命中 */
  }

  // 2) 未命中：正常渲染，再回写缓存
  const res = await handler.fetch(req, env, ctx);

  try {
    if (matchesKind(res, kind)) {
      const headers = new Headers(res.headers);
      // Vary 里带 rsc / next-router-* 会让 Cache API 的 match 永远失败，去掉它，
      // 因为缓存 key 已经按 __v 区分过内容类型了。
      headers.delete("vary");
      headers.delete("set-cookie");
      headers.delete("content-length");
      headers.set("Cache-Control", EDGE_CACHE_CONTROL);
      headers.set("x-edge-cache", "MISS");

      const body = await res.arrayBuffer();
      const stored = new Response(body.slice(0), { status: 200, headers });
      ctx.waitUntil(cache.put(key, stored).catch(() => {}));
      return new Response(body, { status: 200, headers });
    }
  } catch {
    /* 缓存写入失败不影响本次返回 */
  }

  return res;
}

export default {
  fetch: (request, env, ctx) => handleWithEdgeCache(request, env, ctx),
};

// 与 OpenNext 生成的入口保持一致的导出（Durable Objects 等）
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
