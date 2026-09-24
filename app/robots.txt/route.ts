export const dynamic = "force-dynamic";

function originOf(req: Request): string {
  const h = req.headers;
  return `${h.get("x-forwarded-proto") || "https"}://${h.get("host") || "blog.aixivi.cn"}`;
}

export async function GET(req: Request) {
  const origin = originOf(req);
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate",
    },
  });
}
