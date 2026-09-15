import { NextRequest, NextResponse } from "next/server";
import { cnDay, trackSearch } from "@/lib/db";

export const dynamic = "force-dynamic";

const BOT_UA = /bot|crawler|spider|slurp|bingpreview|headless|python-requests|curl|wget/i;

async function fingerprint(ip: string, ua: string): Promise<string> {
  const data = new TextEncoder().encode(`xivi-blog-search|${ip}|${ua}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf).slice(0, 10))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 记录一次站内搜索。与访问埋点同样是「尽力而为」：
 * 任何异常都静默返回，绝不影响访客的搜索体验。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      q?: string;
      results?: number;
    } | null;

    const q = (body?.q || "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!q) return NextResponse.json({ ok: true, skipped: "empty" });

    const ua = req.headers.get("user-agent") || "";
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ ok: true, skipped: "bot" });
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();

    await trackSearch({
      q,
      results: Math.max(0, Math.floor(Number(body?.results) || 0)),
      visitor: await fingerprint(ip, ua),
      day: cnDay(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
