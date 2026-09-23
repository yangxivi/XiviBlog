import { listPublished } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cnDay } from "@/lib/datetime";
import { detectReader, trackFeedHit, visitorHash } from "@/lib/feed";
import { runInBackground } from "@/lib/runtime";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** SQLite UTC 时间 → RFC 822（RSS 要求） */
function rfc822(utc: string): string {
  const d = new Date((utc || "").replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

function originOf(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "blog.aixivi.cn";
  return `${proto}://${host}`;
}

/** 用标题生成一眼能看清的纯文本摘要 */
function summarize(excerpt: string, content: string): string {
  const raw = excerpt?.trim() || content || "";
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*`>~\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export async function GET(req: Request) {
  const origin = originOf(req);
  let settings = null as Awaited<ReturnType<typeof getSettings>> | null;
  let posts: Awaited<ReturnType<typeof listPublished>> = [];
  try {
    [settings, posts] = await Promise.all([getSettings(), listPublished()]);
  } catch {
    /* 数据库不可用时仍返回一个合法但空的 feed */
  }

  const siteName = settings?.siteName || "曦微博客系统 XiviBlogSystem";
  const siteDesc = settings?.siteDesc || "";
  const items = posts.slice(0, 30);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(siteName)}</title>
    <link>${esc(origin)}</link>
    <description>${esc(siteDesc)}</description>
    <language>zh-CN</language>
    <generator>XIVI Blog</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${esc(origin)}/rss.xml" rel="self" type="application/rss+xml" />
${items
  .map((p) => {
    const url = `${origin}/blog/${encodeURIComponent(p.slug)}`;
    return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${rfc822(p.created_at)}</pubDate>
      <category>${esc(p.tag || "随笔")}</category>
      <description>${esc(summarize(p.excerpt, ""))}</description>
      <content:encoded><![CDATA[<p>${esc(summarize(p.excerpt, ""))}</p><p><a href="${esc(
        url
      )}">阅读全文</a></p>]]></content:encoded>
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>
`;

  // 「RSS 阅读数」埋点：feed 被拉取一次就记一行。
  // RSS 阅读器天生长着爬虫 UA，所以这里不筛爬虫 —— 记录 + 按 UA 归类才看得清谁在读。
  const ua = req.headers.get("user-agent") || "";
  const ip =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  let path = "/rss.xml";
  try {
    path = new URL(req.url).pathname || "/rss.xml";
  } catch {
    /* req.url 异常时用默认路径 */
  }

  void runInBackground(
    (async () => {
      await trackFeedHit({
        path,
        reader: detectReader(ua),
        ua: ua.slice(0, 300),
        visitor: await visitorHash("xivi-blog-feed", ip, ua),
        day: cnDay(),
      });
    })()
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, must-revalidate",
    },
  });
}
