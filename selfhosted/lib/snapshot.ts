import { getDB } from "./db";
import { getSettings } from "./settings";
import { importBackup, type ImportResult } from "./backup-import";
import { BACKUP_VERSION, type BackupFile, type BackupPost } from "./backup";

/* ==========================================================================
 * 站点快照（定时备份）
 *
 * 存储结构刻意拆成「头 + 逐篇明细」：
 *  - 单篇正文再大也不会顶破 D1 的单值上限（2MB），不会因为一篇大文章毁掉整份备份；
 *  - 顺带获得按篇恢复、按篇对比的能力；
 *  - 自动备份用 signature 判重：内容没变就不落一份一模一样的快照。
 * ========================================================================== */

/** 自动快照保留份数 */
export const SNAPSHOT_KEEP_AUTO = 7;
/** 手动快照保留份数 */
export const SNAPSHOT_KEEP_MANUAL = 5;
/** 自动备份间隔（小时） */
export const AUTO_BACKUP_HOURS = 24;

export type SnapshotKind = "auto" | "manual";

export type SnapshotMeta = {
  id: number;
  kind: SnapshotKind;
  note: string;
  posts: number;
  bytes: number;
  signature: string;
  created_at: string;
};

/** 全部文章（含草稿、定时、置顶），与导出文件同一份口径 */
export async function collectPosts(): Promise<BackupPost[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT slug, title, excerpt, content, cover_image, tag, status, pinned, publish_at, created_at, updated_at
       FROM posts ORDER BY created_at ASC`
    )
    .all<BackupPost>();
  return results ?? [];
}

/** 组装一份完整的备份负载（导出接口与快照共用） */
export async function collectBackup(): Promise<BackupFile> {
  const posts = await collectPosts();
  const settings = await getSettings();
  return {
    version: BACKUP_VERSION,
    site: "xivi-blog",
    exportedAt: new Date().toISOString(),
    counts: { posts: posts.length },
    settings,
    posts,
  };
}

/**
 * 内容指纹：篇数 + 每篇的「slug/更新时间/状态/置顶/定时/长度」滚动哈希。
 * 任何一篇改了、增删了、置顶改了，指纹都会变。
 */
export function signatureOf(posts: BackupPost[]): string {
  let h = 0;
  for (const p of posts) {
    const s = `${p.slug}|${p.updated_at}|${p.status}|${p.pinned}|${p.publish_at}|${p.title.length}|${p.content.length}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `${posts.length}-${(h >>> 0).toString(36)}`;
}

export function estimateBytes(posts: BackupPost[]): number {
  let n = 0;
  for (const p of posts) {
    n +=
      (p.content?.length ?? 0) +
      (p.excerpt?.length ?? 0) +
      (p.title?.length ?? 0) +
      (p.cover_image?.length ?? 0) +
      200;
  }
  return n;
}

export type CreateResult = {
  id: number | null;
  posts: number;
  bytes: number;
  /** true = 自动备份发现内容没变，跳过 */
  skipped: boolean;
};

/**
 * 创建一份快照。kind='auto' 时若内容指纹与上一份自动快照一致则跳过。
 * 中途出错会把半成品清掉，绝不留一份残缺备份（残缺备份比没有更危险）。
 */
export async function createSnapshot(
  kind: SnapshotKind,
  note = ""
): Promise<CreateResult> {
  const data = await collectBackup();
  const posts = data.posts;
  const signature = signatureOf(posts);
  const bytes = estimateBytes(posts);
  const db = await getDB();

  if (kind === "auto") {
    const last = await db
      .prepare(
        "SELECT signature FROM backup_snapshots WHERE kind='auto' ORDER BY id DESC LIMIT 1"
      )
      .first<{ signature: string }>();
    if (last && last.signature === signature) {
      return { id: null, posts: posts.length, bytes, skipped: true };
    }
  }

  const head = await db
    .prepare(
      `INSERT INTO backup_snapshots (kind, note, posts, bytes, signature, settings_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(kind, note.slice(0, 120), posts.length, bytes, signature, JSON.stringify(data.settings))
    .run();

  const id = head.meta.last_row_id ?? null;
  if (!id) throw new Error("快照创建失败：未拿到自增 ID");

  try {
    const stmt = db.prepare(
      `INSERT INTO backup_snapshot_items
         (snapshot_id, slug, title, excerpt, content, cover_image, tag, status, pinned, publish_at, created_at, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`
    );
    // 分批：一次塞几十条，既避开语句长度上限，也不至于跑几十轮往返
    const CHUNK = 40;
    for (let i = 0; i < posts.length; i += CHUNK) {
      const batch = posts.slice(i, i + CHUNK).map((p) =>
        stmt.bind(
          id,
          p.slug,
          p.title,
          String(p.excerpt ?? ""),
          String(p.content ?? ""),
          String(p.cover_image ?? ""),
          String(p.tag ?? ""),
          p.status === "published" ? "published" : "draft",
          p.pinned ? 1 : 0,
          String(p.publish_at ?? ""),
          String(p.created_at ?? ""),
          String(p.updated_at ?? "")
        )
      );
      if (batch.length) await db.batch(batch);
    }
  } catch (e) {
    await deleteSnapshot(id);
    throw e;
  }

  await pruneSnapshots();
  return { id, posts: posts.length, bytes, skipped: false };
}

export async function listSnapshots(limit = 30): Promise<SnapshotMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, kind, note, posts, bytes, signature, created_at
         FROM backup_snapshots ORDER BY id DESC LIMIT ?1`
    )
    .bind(limit)
    .all<SnapshotMeta>();
  return results ?? [];
}

/** 还原成标准备份文件（下载 / 恢复共用） */
export async function getSnapshotData(id: number): Promise<BackupFile | null> {
  const db = await getDB();
  const head = await db
    .prepare("SELECT * FROM backup_snapshots WHERE id=?1")
    .bind(id)
    .first<SnapshotMeta & { settings_json: string }>();
  if (!head) return null;

  const { results } = await db
    .prepare(
      `SELECT slug, title, excerpt, content, cover_image, tag, status, pinned, publish_at, created_at, updated_at
         FROM backup_snapshot_items WHERE snapshot_id=?1 ORDER BY id ASC`
    )
    .bind(id)
    .all<BackupPost>();

  let settings: unknown = null;
  try {
    settings = head.settings_json ? JSON.parse(head.settings_json) : null;
  } catch {
    settings = null;
  }

  return {
    version: BACKUP_VERSION,
    site: "xivi-blog",
    exportedAt: new Date().toISOString(),
    counts: { posts: results?.length ?? 0 },
    settings,
    posts: results ?? [],
  };
}

export async function deleteSnapshot(id: number): Promise<boolean> {
  try {
    const db = await getDB();
    await db
      .prepare("DELETE FROM backup_snapshot_items WHERE snapshot_id=?1")
      .bind(id)
      .run();
    const r = await db
      .prepare("DELETE FROM backup_snapshots WHERE id=?1")
      .bind(id)
      .run();
    return (r.meta.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * 从快照恢复。
 * 覆盖式恢复前先自动存一份当前状态的「恢复前快照」—— 恢复错版本是这类功能最容易出的事故。
 */
export async function restoreSnapshot(
  id: number,
  opts: { mode?: "merge" | "replace"; withSettings?: boolean } = {}
): Promise<ImportResult & { safetySnapshotId: number | null }> {
  const data = await getSnapshotData(id);
  if (!data) throw new Error("快照不存在或已删除");

  let safetySnapshotId: number | null = null;
  if ((opts.mode ?? "merge") === "replace") {
    try {
      const safety = await createSnapshot("manual", `恢复 #${id} 前的自动存档`);
      safetySnapshotId = safety.id;
    } catch {
      // 存档失败不阻断恢复：用户可能正是因为库已损坏才来恢复
    }
  }

  const result = await importBackup(data, opts);
  return { ...result, safetySnapshotId };
}

/** 保留策略：自动 7 份、手动 5 份，超出从最旧的删起 */
export async function pruneSnapshots(): Promise<number> {
  const db = await getDB();
  let removed = 0;
  const plan: [SnapshotKind, number][] = [
    ["auto", SNAPSHOT_KEEP_AUTO],
    ["manual", SNAPSHOT_KEEP_MANUAL],
  ];
  for (const [kind, keep] of plan) {
    const { results } = await db
      .prepare("SELECT id FROM backup_snapshots WHERE kind=?1 ORDER BY id DESC")
      .bind(kind)
      .all<{ id: number }>();
    for (const row of (results ?? []).slice(keep)) {
      if (await deleteSnapshot(row.id)) removed++;
    }
  }
  return removed;
}

export type SnapshotStats = {
  total: number;
  auto: number;
  manual: number;
  bytes: number;
  lastAutoAt: string;
  lastManualAt: string;
  lastSignature: string;
};

export async function getSnapshotStats(): Promise<SnapshotStats> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT COUNT(*)                                     AS total,
              SUM(CASE WHEN kind='auto' THEN 1 ELSE 0 END)  AS auto,
              SUM(CASE WHEN kind='manual' THEN 1 ELSE 0 END) AS manual,
              SUM(bytes)                                    AS bytes,
              MAX(CASE WHEN kind='auto' THEN created_at END)   AS lastAutoAt,
              MAX(CASE WHEN kind='manual' THEN created_at END) AS lastManualAt
         FROM backup_snapshots`
    )
    .first<Omit<SnapshotStats, "lastSignature">>();
  const sig = await db
    .prepare("SELECT signature FROM backup_snapshots ORDER BY id DESC LIMIT 1")
    .first<{ signature: string }>();
  return {
    total: row?.total ?? 0,
    auto: row?.auto ?? 0,
    manual: row?.manual ?? 0,
    bytes: row?.bytes ?? 0,
    lastAutoAt: row?.lastAutoAt ?? "",
    lastManualAt: row?.lastManualAt ?? "",
    lastSignature: sig?.signature ?? "",
  };
}

/** 定时任务体：内容变了才真的落一份 */
export async function autoBackupJob(): Promise<CreateResult> {
  return createSnapshot("auto", "每日自动备份");
}
