import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

/** URL 里带内容指纹（v=），封面换了 URL 就换，所以可以放心用一年期长缓存 */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** data URL → 二进制 + mime */
function decodeDataUrl(
  dataUrl: string
): { bytes: Uint8Array; type: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const type = m[1] || "application/octet-stream";
  const payload = m[3] ?? "";
  if (!m[2]) {
    try {
      return {
        bytes: new TextEncoder().encode(decodeURIComponent(payload)),
        type,
      };
    } catch {
      return null;
    }
  }
  try {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type };
  } catch {
    return null;
  }
}

/**
 * 封面原图直出（首页轮播用）。背景与动机见 lib/cover-url.ts。
 *
 * 把 base64 大图变成真实图片 URL 后，`<img>` 可以直接写在 SSR HTML 里，
 * 浏览器解析到即开始下载，首屏就是高清——不再出现「小图先上、原图后换」的闪烁。
 *
 * 关于缓存（别在这里再加 Worker 内的 Cache API，实测无收益）：
 *  - 浏览器侧靠 `immutable` 长缓存，实测二次访问 transferSize=0（零下载）；
 *  - Cloudflare 边缘侧同样会缓存它（实测 CF-Cache-Status: HIT、Age 数百秒）——
 *    带显式 Cache-Control 的**图片**走的是 Cloudflare 默认缓存规则。
 *    custom-worker.ts 之所以要手写 Cache API，是因为 Cloudflare 默认**不缓存 HTML**；
 *    图片没这个问题。这里试过 Cache API：`put` 成功（cache:yes|put:ok）但 `match`
 *    永远不中，等于白写一层还让人误判缓存状态，故移除。
 */
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return new NextResponse("bad id", { status: 400 });
  }

  let src = "";
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT cover_image FROM posts WHERE id=?1")
      .bind(id)
      .first<{ cover_image: string }>();
    src = row?.cover_image || "";
  } catch {
    return new NextResponse("db error", { status: 500 });
  }
  if (!src) return new NextResponse("no cover", { status: 404 });

  // 站外封面（站长直接填 URL）：交给浏览器去取，这个跳转本身短缓存即可
  if (!src.startsWith("data:")) {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: src, "Cache-Control": "public, max-age=300" },
    });
  }

  const parsed = decodeDataUrl(src);
  if (!parsed) return new NextResponse("bad cover", { status: 500 });

  // 用底层 ArrayBuffer 作为 body：Uint8Array 在当前 undici/TS 组合下不满足 BodyInit。
  // 不手动设 Content-Length：交给运行时按实际 body 计算，避免与压缩/分块策略冲突。
  const buffer = parsed.bytes.buffer as ArrayBuffer;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": parsed.type,
      "Cache-Control": IMMUTABLE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
