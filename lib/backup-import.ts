import { getDB } from "./db";
import { saveSettings } from "./settings";
import type { BackupFile } from "./backup";

/**
 * 备份导入 —— 文件导入与快照恢复共用同一份逻辑，
 * 免得两条路径的字段处理慢慢跑偏（历史上最容易出现「文件能恢复、快照恢复少字段」）。
 */
export type ImportResult = {
  mode: "merge" | "replace";
  inserted: number;
  updated: number;
  settingsRestored: boolean;
};

export async function importBackup(
  data: BackupFile,
  opts: { mode?: "merge" | "replace"; withSettings?: boolean } = {}
): Promise<ImportResult> {
  if (!data || !Array.isArray(data.posts)) {
    throw new Error("备份内容格式不正确");
  }
  if (data.posts.length > 5000) {
    throw new Error("单次最多导入 5000 篇");
  }

  const mode = opts.mode === "replace" ? "replace" : "merge";
  const db = await getDB();
  let inserted = 0;
  let updated = 0;

  if (mode === "replace") {
    await db.prepare("DELETE FROM posts").run();
  }

  for (const p of data.posts) {
    const slug = String(p.slug || "").trim();
    const title = String(p.title || "").trim();
    if (!slug || !title) continue;

    const exists = await db
      .prepare("SELECT id FROM posts WHERE slug=?1")
      .bind(slug)
      .first<{ id: number }>();

    const vals = [
      title,
      String(p.excerpt ?? ""),
      String(p.content ?? ""),
      String(p.cover_image ?? ""),
      String(p.tag || "随笔"),
      p.status === "published" ? "published" : "draft",
      p.pinned ? 1 : 0,
      String(p.publish_at ?? ""),
    ] as const;

    if (exists) {
      await db
        .prepare(
          "UPDATE posts SET title=?1, excerpt=?2, content=?3, cover_image=?4, tag=?5, status=?6, pinned=?7, publish_at=?8, updated_at=datetime('now') WHERE id=?9"
        )
        .bind(...vals, exists.id)
        .run();
      updated++;
    } else {
      const created = String(p.created_at ?? "").trim();
      await db
        .prepare(
          `INSERT INTO posts (slug, title, excerpt, content, cover_image, tag, status, pinned, publish_at, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,${created ? "?10" : "datetime('now')"},datetime('now'))`
        )
        .bind(...(created ? [slug, ...vals, created] : [slug, ...vals]))
        .run();
      inserted++;
    }
  }

  let settingsRestored = false;
  if (opts.withSettings && data.settings) {
    await saveSettings(data.settings);
    settingsRestored = true;
  }

  return { mode, inserted, updated, settingsRestored };
}
