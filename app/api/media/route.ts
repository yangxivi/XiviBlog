import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export type MediaItem = {
  url: string;
  kind: "inline" | "external" | "local";
  count: number;
  posts: { id: number; title: string; slug: string }[];
};

type Row = {
  id: number;
  title: string;
  slug: string;
  cover_image: string;
};

function kindOf(url: string): MediaItem["kind"] {
  if (url.startsWith("data:")) return "inline";
  if (/^https?:\/\//i.test(url)) return "external";
  return "local";
}

/** 汇总所有被文章引用的封面图 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT id, title, slug, cover_image FROM posts WHERE COALESCE(cover_image,'') <> '' ORDER BY created_at DESC"
    )
    .all<Row>();

  const map = new Map<string, MediaItem>();
  for (const r of results ?? []) {
    const url = r.cover_image.trim();
    if (!url) continue;
    const hit = map.get(url);
    if (hit) {
      hit.count += 1;
      hit.posts.push({ id: r.id, title: r.title, slug: r.slug });
    } else {
      map.set(url, {
        url,
        kind: kindOf(url),
        count: 1,
        posts: [{ id: r.id, title: r.title, slug: r.slug }],
      });
    }
  }

  const items = [...map.values()].sort((a, b) => b.count - a.count);
  const totalPosts = (results ?? []).length;
  const inlineBytes = items
    .filter((i) => i.kind === "inline")
    .reduce((n, i) => n + i.url.length, 0);

  return NextResponse.json({ items, totalPosts, inlineBytes });
}

type Body = { action?: unknown; url?: unknown };

/** 解除引用：把用到该图的文章封面清空 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const url = typeof body?.url === "string" ? body.url : "";

  if (action !== "detach" || !url) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }

  const db = await getDB();
  try {
    const r = await db
      .prepare(
        "UPDATE posts SET cover_image='', updated_at=datetime('now') WHERE cover_image=?1"
      )
      .bind(url)
      .run();
    return NextResponse.json({ ok: true, affected: r.meta?.changes ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `操作失败：${msg}` }, { status: 500 });
  }
}
