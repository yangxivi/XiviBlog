import { NextRequest, NextResponse } from "next/server";
import { cnDay, trackView } from "@/lib/db";
import { heartbeat } from "@/lib/maintenance";
import { runInBackground } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/** 后台与静态资源不统计 */
const SKIP_PATH = /^\/(admin|api|_next|favicon|icon|apple-icon|covers)/;
/** 常见爬虫 / 预览抓取 */
const BOT_UA =
  /bot|crawler|spider|slurp|bingpreview|headless|facebookexternalhit|python-requests|curl|wget/i;

/** 匿名指纹：应用盐 + IP + UA 的 SHA-256 截断（不落库原始 IP） */
async function fingerprint(ip: string, ua: string): Promise<string> {
  const data = new TextEncoder().encode(`xivi-blog|${ip}|${ua}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf).slice(0, 10))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      path?: string;
      referrer?: string;
    } | null;

    const path = (body?.path || "").trim().slice(0, 300);
    if (!path) return NextResponse.json({ ok: true, skipped: "empty" });
    if (SKIP_PATH.test(path)) {
      return NextResponse.json({ ok: true, skipped: "path" });
    }

    const ua = req.headers.get("user-agent") || "";
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ ok: true, skipped: "bot" });
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();

    await trackView({
      path,
      referrer: (body?.referrer || "").trim().slice(0, 300),
      ua: ua.slice(0, 300),
      visitor: await fingerprint(ip, ua),
      day: cnDay(),
    });

    // 顺带踢一脚定时任务（自动备份 / 友链检测 / 数据清理）：
    // 用 waitUntil 挂后台，访客的响应不受影响；是否真的到期由心跳调度器判断。
    void runInBackground(heartbeat());

    return NextResponse.json({ ok: true });
  } catch {
    // 埋点失败绝不影响访客
    return NextResponse.json({ ok: false });
  }
}
