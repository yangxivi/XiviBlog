import { listPublished, listTags } from "@/lib/db";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** SQLite UTC → W3C datetime */
function w3c(utc: string): string {
  const d = new Date((utc || "").replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function originOf(req: Request): string {
  const h = req.headers;
  return `${h.get("x-forwarded-proto") || "https"}://${h.get("host") || "blog.aixivi.cn"}`;
}

export async function GET(req: Request) {
  const origin = originOf(req);
  let posts: Awaited<ReturnType<typeof listPublished>> = [];
  let tags: Awaited<ReturnType<typeof listTags>> = [];
  try {
    [posts, tags] = await Promise.all([listPublished(), listTags()]);
  } catch {
    /* 数据库不可用时返回静态页部分 */
  }

  type Entry = { loc: string; lastmod: string; changefreq: string; priority: string };
  const entries: Entry[] = [
    { loc: `${origin}/`, lastmod: new Date().toISOString(), changefreq: "daily", priority: "1.0" },
    { loc: `${origin}/history`, lastmod: new Date().toISOString(), changefreq: "weekly", priority: "0.6" },
    { loc: `${origin}/about`, lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.5" },
  ];

  for (const p of posts) {
    entries.push({
      loc: `${origin}/blog/${encodeURIComponent(p.slug)}`,
      lastmod: w3c(p.updated_at || p.created_at),
      changefreq: "monthly",
      priority: "0.8",
    });
  }
  for (const t of tags) {
    if (!t.tag) continue;
    entries.push({
      loc: `${origin}/search?q=${encodeURIComponent(t.tag)}`,
      lastmod: new Date().toISOString(),
      changefreq: "weekly",
      priority: "0.4",
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${esc(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, must-revalidate",
    },
  });
}
