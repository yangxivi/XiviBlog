/**
 * 轮播封面原图的 URL 构造。
 *
 * 背景：封面在 D1 里存的是 base64 data URL。
 *  - 列表小图（240×135 WebP，单张 2-3KB）**内联**进 HTML 很划算：零请求、
 *    随首屏一起出现，所以列表继续用 base64。
 *  - 轮播要的是原图（635×360，单张 40KB+）。内联进 RSC flight 会让首屏膨胀
 *    上百 KB 并可能触发 hydration 异常，于是早先的做法是「SSR 先渲染小图，
 *    客户端再拉 /api/carousel 换成原图」——代价是每次打开首页都要先虚 2-3 秒。
 *
 * 现在把轮播封面改成**真实图片 URL**：`<img>` 回到 SSR HTML 里，浏览器解析到
 * 就发起请求（配 `rel=preload` 还能更早），首屏直接就是高清，不存在「先虚后清」。
 * 顺带还能被浏览器与边缘缓存复用，重复访问零成本、HTML 也不再背着这几张大图。
 *
 * URL 上的 `v` 是内容指纹（封面 base64 + updated_at 做 FNV-1a），封面一换 URL 就变，
 * 所以 /api/posts/cover 可以放心用 immutable 长缓存。
 */
export function coverUrl(
  id: number,
  source: string,
  updatedAt = ""
): string {
  return `/api/posts/cover?id=${id}&v=${fingerprint(source + "|" + updatedAt)}`;
}

/** 极短的非加密指纹（base36，≤7 字符），只作缓存键用，不承担安全职责 */
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
