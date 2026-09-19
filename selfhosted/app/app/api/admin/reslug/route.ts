import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { englishSlugFromTitle, hasCJK } from "@/lib/slug-en";

/**
 * 存量中文 slug 批量回填为英文（标题自动翻译）。
 * POST /api/admin/reslug  （需登录）
 * 返回 { changed: [{ id, old, slug }] }；翻译失败的篇目带 error 字段，可重跑。
 */
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT id, slug, title FROM posts")
    .all<{ id: number; slug: string; title: string }>();

  const changed: Array<{ id: number; old: string; slug?: string; error?: string }> = [];
  for (const p of results ?? []) {
    if (!hasCJK(p.slug)) continue;
    const en = await englishSlugFromTitle(p.title);
    if (!en) {
      const { debugEndpoints } = await import("@/lib/slug-en");
      const diag = await debugEndpoints(p.title);
      changed.push({ id: p.id, old: p.slug, error: "translate-failed: " + diag.join(" | ") });
      continue;
    }
    // 唯一性（排除自身）：-2、-3 递增
    let final = en;
    let i = 2;
    for (;;) {
      const hit = await db
        .prepare("SELECT id FROM posts WHERE slug=?1")
        .bind(final)
        .first<{ id: number }>();
      if (!hit || hit.id === p.id) break;
      final = `${en}-${i++}`;
    }
    await db
      .prepare("UPDATE posts SET slug=?1 WHERE id=?2")
      .bind(final, p.id)
      .run();
    changed.push({ id: p.id, old: p.slug, slug: final });
  }

  return NextResponse.json({ ok: true, changed });
}
