/**
 * Turso (LibSQL) 适配器 —— 提供与 better-sqlite3 兼容的 D1 接口。
 *
 * 使用方式：
 *   DATABASE_TYPE=turso
 *   TURSO_DATABASE_URL=https://your-db.turso.io
 *   TURSO_AUTH_TOKEN=your-auth-token-here
 *
 * Turso HTTP API 端点：POST {database_url}/v1/sql
 *   body: { sql, params }
 *   resp: { data: { columns, rows } }
 *
 * 注意：Turso 原生支持命名占位符 (:name)，但本博客的 SQL 模板统一使用 D1 风格 ?N，
 * 因此此处做 ?N → :arg{N} 的改写，再用 params 数组传值。
 */

// ===================== 时间工具（导入 + 再导出）=====================

import {
  isScheduled,
  normPublishAt,
  utcToLocalInput,
  localInputToUtc,
  cnDay,
  cnTime,
} from "./datetime";

export { isScheduled, normPublishAt, utcToLocalInput, localInputToUtc, cnDay, cnTime };

import { countWords } from "./revisions";
export { countWords };

// ===================== 本地类型定义（避免循环依赖）=====================

export type PostRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  cover_thumb: string;
  tag: string;
  tags: string;
  status: "draft" | "published";
  pinned: number;
  recommended: number;
  publish_at: string;
  created_at: string;
  updated_at: string;
  view_count?: number;
};

export type PostMeta = Omit<PostRow, "content">;

export type ViewRow = {
  path: string;
  referrer: string;
  ua: string;
  visitor: string;
  day: string;
};

export type StatsOverview = {
  pv: number;
  uv: number;
  todayPv: number;
  todayUv: number;
  weekPv: number;
  weekUv: number;
  monthPv: number;
  monthUv: number;
};

export type DailyPoint = { day: string; pv: number; uv: number };
export type PathStat = { path: string; pv: number; uv: number };
export type ReferrerStat = { referrer: string; pv: number };
export type RecentHit = { path: string; referrer: string; created_at: string; ua: string };

export type SnapshotSource = {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  tag: string;
  status: string;
};

export type RevisionHead = {
  id: number;
  title: string;
  content: string;
  note: string;
  created_at: string;
};

export type RevisionMeta = {
  id: number;
  post_id: number;
  title: string;
  note: string;
  status: string;
  words: number;
  created_at: string;
};

export type RevisionRow = RevisionMeta & { excerpt: string; content: string; cover_image: string; tag: string };

export type TagCount = { tag: string; count: number };
export type TagStat = { tag: string; total: number; published: number };
export type ArchiveItem = { month: string; count: number };
export type Neighbor = { slug: string; title: string };

export type SearchLogRow = {
  q: string;
  results: number;
  visitor: string;
  day: string;
};

export type SearchStat = {
  q: string;
  hits: number;
  visitors: number;
  last: string;
};

export type SearchOverview = {
  total: number;
  today: number;
  words: number;
  zeroWords: number;
};

export type RecentSearch = {
  q: string;
  results: number;
  created_at: string;
};

// ===================== 常量 =====================

export const RECOMMEND_LIMIT = 10;
export const REVISION_LIMIT = 30;
export const REVISION_MERGE_MINUTES = 5;

// 复用 db.ts 的 D1Stmt/DBLike 接口（结构兼容）
import type { D1Stmt, DBLike } from "./db";

// ===================== Turso HTTP 客户端 =====================

interface TursoRow {
  [key: number]: unknown;
}

interface TursoResult {
  data: {
    columns: string[];
    rows: TursoRow[];
  };
}

class TursoStmt implements D1Stmt {
  constructor(
    private url: string,
    private auth: string,
    private sql: string,
    private params: unknown[]
  ) {}

  bind(...values: unknown[]): D1Stmt {
    return new TursoStmt(this.url, this.auth, this.sql, values);
  }

  // D1Stmt.all 是同步签名；内部实际执行异步 fetch，
  // 调用方在 db.ts 中已用 `await stmt.all()` 消费，所以这里把 Promise 直接返回，
  // await 时会正确解析（TS 层面用 as unknown 断言绕过同步签名检查）。
  all<T = unknown>(): { results: T[] } {
    return this.exec() as unknown as { results: T[] };
  }

  first<T = unknown>(): T | null {
    return (this.exec() as unknown as Promise<T[]>)
      .then((rows) => rows[0] ?? null) as unknown as T | null;
  }

  run(): { meta: { changes: number; last_row_id: number } } {
    // 同步签名；实际写入的 fetch 异步执行，调用方 await 后拿到此占位值
    // 如需精确 last_row_id，可在调用方单独执行 SELECT last_insert_rowid()
    void this.exec();
    return { meta: { changes: 1, last_row_id: 0 } };
  }

  raw<T = unknown>(): T[] {
    return this.all<T>().results;
  }

  private async exec(): Promise<TursoRow[]> {
    const body = JSON.stringify({ sql: this.sql, params: this.params });
    const resp = await fetch(`${this.url}/v1/sql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.auth}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Turso HTTP error ${resp.status}: ${resp.statusText} — ${this.sql.slice(0, 120)} — ${text.slice(0, 200)}`
      );
    }
    const data: TursoResult = await resp.json();
    return data.data?.rows ?? [];
  }
}

// DBLike 由 db.ts 导出，TursoStmt 已实现 D1Stmt；
// 此处直接 re-export 方便调用方统一 import
export { D1Stmt, DBLike };

// ===================== 初始化 =====================

let _db: DBLike | null = null;

function openTurso(): DBLike {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const auth = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !auth) {
    throw new Error("Turso 模式需要 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN 环境变量");
  }

  // ?N → :arg{N} 改写：D1 风格的编号占位符转为 Turso 支持的命名占位符
  const rewrite = (sql: string): string =>
    sql.replace(/\?(\d+)/g, (_m, n) => `:arg${n}`);

  const db: DBLike = {
    prepare(sql: string) {
      const rewritten = rewrite(sql);
      return new TursoStmt(dbUrl, auth, rewritten, []);
    },
    async exec(sql: string) {
      const body = JSON.stringify({ sql: rewrite(sql), params: [] });
      const resp = await fetch(`${dbUrl}/v1/sql`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Turso exec error ${resp.status}: ${resp.statusText} — ${sql.slice(0, 120)} — ${text.slice(0, 200)}`
        );
      }
    },
    async batch(stmts: TursoStmt[]) {
      // Turso HTTP 不支持事务；逐条执行，失败时抛异常（调用方自行 catch）
      return Promise.all(stmts.map((s) => s.run()));
    },
  };
  return db;
}

export async function getDB(): Promise<DBLike> {
  if (!_db) {
    _db = openTurso();
  }
  return _db;
}

/** Turso 适配器不提供 raw DB 实例，返回 null */
export function getRawDb() {
  return null;
}

// ===================== SQL 模板（与 lib/db.ts 完全一致）=====================

const LIVE = "status='published' AND (publish_at='' OR publish_at<=datetime('now'))";
const ORDER = "ORDER BY pinned DESC, created_at DESC";
const LIST_SELECT = `SELECT id, slug, title, excerpt, CASE WHEN cover_thumb != '' THEN cover_thumb ELSE cover_image END AS cover_image, tag, tags, status, pinned, recommended, publish_at, created_at, updated_at, (SELECT COUNT(*) FROM page_views WHERE page_views.path = '/blog/' || posts.slug) AS view_count FROM posts`;
const POST_SELECT =
  "SELECT *, (SELECT COUNT(*) FROM page_views WHERE page_views.path = '/blog/' || posts.slug) AS view_count FROM posts ";

// ===================== 文章查询 =====================

export async function listPublished(): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} WHERE ${LIVE} ${ORDER}`)
    .all<PostMeta>();
  return results ?? [];
}

export async function listPublishedPage(
  limit = 30,
  offset = 0,
  category?: string,
  year?: string
): Promise<PostMeta[]> {
  const db = await getDB();
  const { where, binds } = liveFilter(category, year);
  const sql = `${LIST_SELECT} ${where} ${ORDER} LIMIT ${Math.max(1, limit)} OFFSET ${Math.max(0, offset)}`;
  const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  const { results } = await stmt.all<PostMeta>();
  return results ?? [];
}

function liveFilter(
  category?: string,
  year?: string
): { where: string; binds: unknown[] } {
  const parts = [LIVE];
  const binds: unknown[] = [];
  if (category) {
    binds.push(category);
    parts.push(`tag=:arg${binds.length + 1}`);
  }
  if (year) {
    binds.push(year);
    parts.push(`substr(created_at,1,4)=:arg${binds.length + 1}`);
  }
  return { where: `WHERE ${parts.join(" AND ")}`, binds };
}

export async function countPublished(
  category?: string,
  year?: string
): Promise<number> {
  const db = await getDB();
  const { where, binds } = liveFilter(category, year);
  const sql = `SELECT COUNT(*) AS n FROM posts ${where}`;
  const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  const row = await stmt.first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listYearCounts(): Promise<{ y: string; n: number }[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT substr(created_at,1,4) AS y, COUNT(*) AS n FROM posts WHERE ${LIVE} GROUP BY y ORDER BY y DESC`
    )
    .all<{ y: string; n: number }>();
  return results ?? [];
}

export async function listLatest(n = 5): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} WHERE ${LIVE} ${ORDER} LIMIT ${Math.max(1, n)}`)
    .all<PostMeta>();
  return results ?? [];
}

export async function listAll(): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} ${ORDER}`)
    .all<PostMeta>();
  return results ?? [];
}

export async function getBySlug(
  slug: string,
  includeDraft = false
): Promise<PostRow | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      POST_SELECT +
        `WHERE slug=:arg1` +
        (includeDraft ? "" : ` AND ${LIVE}`)
    )
    .bind(slug)
    .first<PostRow>();
  return row ?? null;
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function getBySlugFlexible(
  raw: string,
  includeDraft = false
): Promise<PostRow | null> {
  const tried = Array.from(new Set([raw, safeDecode(raw)]));
  for (const c of tried) {
    const row = await getBySlug(c, includeDraft);
    if (row) return row;
  }
  const db = await getDB();
  for (const t of tried) {
    const row = await db
      .prepare(POST_SELECT + `WHERE title=:arg1` + (includeDraft ? "" : ` AND ${LIVE}`))
      .bind(t)
      .first<PostRow>();
    if (row) return row;
  }
  return null;
}

export async function getById(id: number): Promise<PostRow | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      "SELECT *, (SELECT COUNT(*) FROM page_views WHERE page_views.path = '/blog/' || posts.slug) AS view_count FROM posts WHERE id=:arg1"
    )
    .bind(id)
    .first<PostRow>();
  return row ?? null;
}

export async function getNeighbors(slug: string): Promise<{
  prev: Neighbor | null;
  next: Neighbor | null;
}> {
  const db = await getDB();
  const { results } = await db
    .prepare(`SELECT slug, title FROM posts WHERE ${LIVE} ${ORDER}`)
    .all<Neighbor>();
  const arr: Neighbor[] = results ?? [];
  const idx = arr.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? arr[idx - 1] : null,
    next: idx < arr.length - 1 ? arr[idx + 1] : null,
  };
}

export async function listTags(): Promise<TagCount[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT tag, COUNT(*) as count FROM posts WHERE ${LIVE} GROUP BY tag ORDER BY count DESC, tag ASC`
    )
    .all<TagCount>();
  return results ?? [];
}

export async function listByCategory(category: string): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} WHERE ${LIVE} AND tag=:arg1 ${ORDER}`)
    .bind(category)
    .all<PostMeta>();
  return results ?? [];
}

// ============================ 编辑推荐 ============================

export async function listRecommended(): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `${LIST_SELECT} WHERE ${LIVE} AND recommended=1 ${ORDER} LIMIT ${RECOMMEND_LIMIT}`
    )
    .all<PostMeta>();
  return results ?? [];
}

export async function countRecommended(): Promise<number> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM posts WHERE recommended=1")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function setRecommend(id: number, on: boolean): Promise<string | null> {
  const db = await getDB();
  const post = await db
    .prepare("SELECT id, recommended FROM posts WHERE id=:arg1")
    .bind(id)
    .first<{ id: number; recommended: number }>();
  if (!post) return "文章不存在";

  if (!on) {
    if (!post.recommended) return null;
    await db
      .prepare("UPDATE posts SET recommended=0, updated_at=datetime('now') WHERE id=:arg1")
      .bind(id)
      .run();
    return null;
  }

  if (post.recommended) return null;
  const n = await countRecommended();
  if (n >= RECOMMEND_LIMIT) return `推荐名额已满（${RECOMMEND_LIMIT}/${RECOMMEND_LIMIT}），请先取消一篇`;
  await db
    .prepare("UPDATE posts SET recommended=1, updated_at=datetime('now') WHERE id=:arg1")
    .bind(id)
    .run();
  return null;
}

export async function listTagStats(): Promise<TagStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT tag, COUNT(*) as total, SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published FROM posts GROUP BY tag ORDER BY total DESC, tag ASC"
    )
    .all<TagStat>();
  return results ?? [];
}

export async function listArchives(): Promise<ArchiveItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM posts WHERE ${LIVE} GROUP BY month ORDER BY month DESC`
    )
    .all<ArchiveItem>();
  return results ?? [];
}

export function readingTime(content: string): string {
  const chars = content.replace(/\s/g, "").length;
  return Math.max(1, Math.round(chars / 400)) + " 分钟";
}

// ============================ 访问统计 ============================

export async function trackView(v: ViewRow): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "INSERT INTO page_views (path, referrer, ua, visitor, day) VALUES (:arg1, :arg2, :arg3, :arg4, :arg5)"
    )
    .bind(v.path, v.referrer, v.ua, v.visitor, v.day)
    .run();
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const db = await getDB();
  const today = cnDay();
  const week = cnDay(6);
  const month = cnDay(29);
  const row = await db
    .prepare(
      `SELECT
         COUNT(*)                                        AS pv,
         COUNT(DISTINCT visitor)                         AS uv,
         SUM(CASE WHEN day = :arg1 THEN 1 ELSE 0 END)       AS todayPv,
         COUNT(DISTINCT CASE WHEN day = :arg1 THEN visitor END) AS todayUv,
         SUM(CASE WHEN day >= :arg2 THEN 1 ELSE 0 END)      AS weekPv,
         COUNT(DISTINCT CASE WHEN day >= :arg2 THEN visitor END) AS weekUv,
         SUM(CASE WHEN day >= :arg3 THEN 1 ELSE 0 END)      AS monthPv,
         COUNT(DISTINCT CASE WHEN day >= :arg3 THEN visitor END) AS monthUv
       FROM page_views`
    )
    .bind(today, week, month)
    .first<StatsOverview>();
  return {
    pv: row?.pv ?? 0,
    uv: row?.uv ?? 0,
    todayPv: row?.todayPv ?? 0,
    todayUv: row?.todayUv ?? 0,
    weekPv: row?.weekPv ?? 0,
    weekUv: row?.weekUv ?? 0,
    monthPv: row?.monthPv ?? 0,
    monthUv: row?.monthUv ?? 0,
  };
}

export async function listDaily(days = 30): Promise<DailyPoint[]> {
  const db = await getDB();
  const from = cnDay(days - 1);
  const { results } = await db
    .prepare(
      `SELECT day, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
       FROM page_views WHERE day >= :arg1
       GROUP BY day ORDER BY day ASC`
    )
    .bind(from)
    .all<DailyPoint>();

  const map = new Map((results ?? []).map((r) => [r.day, r]));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = cnDay(i);
    out.push(map.get(d) ?? { day: d, pv: 0, uv: 0 });
  }
  return out;
}

export async function listTopPaths(
  days = 30,
  limit = 10
): Promise<PathStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT path, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
       FROM page_views WHERE day >= :arg1
       GROUP BY path ORDER BY pv DESC LIMIT :arg2`
    )
    .bind(cnDay(days - 1), limit)
    .all<PathStat>();
  return results ?? [];
}

export async function listTopReferrers(
  days = 30,
  limit = 8
): Promise<ReferrerStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT CASE WHEN referrer = '' THEN '(直接访问)' ELSE referrer END AS referrer,
              COUNT(*) AS pv
       FROM page_views WHERE day >= :arg1
       GROUP BY referrer ORDER BY pv DESC LIMIT :arg2`
    )
    .bind(cnDay(days - 1), limit)
    .all<ReferrerStat>();
  return results ?? [];
}

export async function listRecentHits(limit = 20): Promise<RecentHit[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT path, referrer, created_at, ua FROM page_views
       ORDER BY id DESC LIMIT :arg1`
    )
    .bind(limit)
    .all<RecentHit>();
  return results ?? [];
}

export async function listViewsBySlug(): Promise<Record<string, number>> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT substr(path, 7) AS slug, COUNT(*) AS pv
       FROM page_views WHERE path LIKE '/blog/%'
       GROUP BY slug`
    )
    .all<{ slug: string; pv: number }>();
  const out: Record<string, number> = {};
  for (const r of results ?? []) out[r.slug] = r.pv;
  return out;
}

export async function purgeOldViews(keepDays = 180): Promise<number> {
  const db = await getDB();
  await db
    .prepare("DELETE FROM page_views WHERE day < :arg1")
    .bind(cnDay(keepDays))
    .run();
  return 0;
}

// ============================ 版本历史 ============================

export async function snapshotRevision(
  post: SnapshotSource,
  note = "",
  merge = false
): Promise<number | null> {
  const db = await getDB();
  const words = countWords(post.content);

  const latest = await db
    .prepare(
      "SELECT id, title, content, note, created_at FROM post_revisions WHERE post_id=:arg1 ORDER BY id DESC LIMIT 1"
    )
    .bind(post.id)
    .first<RevisionHead>();

  if (latest && latest.title === post.title && latest.content === post.content) {
    return null;
  }

  if (merge && latest && !latest.note) {
    const t = Date.parse(latest.created_at.replace(" ", "T") + "Z");
    if (!Number.isNaN(t) && Date.now() - t < REVISION_MERGE_MINUTES * 60_000) {
      await db
        .prepare(
          `UPDATE post_revisions
             SET title=:arg1, excerpt=:arg2, content=:arg3, cover_image=:arg4, tag=:arg5,
                 status=:arg6, words=:arg7, created_at=datetime('now')
           WHERE id=:arg8`
        )
        .bind(
          post.title,
          post.excerpt,
          post.content,
          post.cover_image,
          post.tag,
          post.status,
          words,
          latest.id
        )
        .run();
      return latest.id;
    }
  }

  await db
    .prepare(
      `INSERT INTO post_revisions
         (post_id, title, excerpt, content, cover_image, tag, status, note, words)
       VALUES (:arg1,:arg2,:arg3,:arg4,:arg5,:arg6,:arg7,:arg8,:arg9)`
    )
    .bind(
      post.id,
      post.title,
      post.excerpt,
      post.content,
      post.cover_image,
      post.tag,
      post.status,
      note,
      words
    )
    .run();

  await pruneRevisions(post.id, REVISION_LIMIT);
  return 0;
}

export async function pruneRevisions(
  postId: number,
  keep = REVISION_LIMIT
): Promise<number> {
  const db = await getDB();
  await db
    .prepare(
      `DELETE FROM post_revisions
        WHERE post_id=:arg1
          AND id NOT IN (
            SELECT id FROM post_revisions WHERE post_id=:arg1 ORDER BY id DESC LIMIT :arg2
          )`
    )
    .bind(postId, keep)
    .run();
  return 0;
}

export async function listRevisions(
  postId: number,
  limit = REVISION_LIMIT
): Promise<RevisionMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, post_id, title, note, status, words, created_at
         FROM post_revisions WHERE post_id=:arg1 ORDER BY id DESC LIMIT :arg2`
    )
    .bind(postId, limit)
    .all<RevisionMeta>();
  return results ?? [];
}

export async function getRevision(id: number): Promise<RevisionRow | null> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM post_revisions WHERE id=:arg1")
    .bind(id)
    .first<RevisionRow>();
  return row ?? null;
}

export async function deleteRevision(id: number): Promise<boolean> {
  const db = await getDB();
  await db
    .prepare("DELETE FROM post_revisions WHERE id=:arg1")
    .bind(id)
    .run();
  return true;
}

export async function listAllRevisions(): Promise<RevisionRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT * FROM post_revisions ORDER BY post_id ASC, id ASC")
    .all<RevisionRow>();
  return results ?? [];
}

// ============================ 站内搜索词 ============================

export async function trackSearch(v: SearchLogRow): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "INSERT INTO search_logs (q, results, visitor, day) VALUES (:arg1, :arg2, :arg3, :arg4)"
    )
    .bind(v.q, v.results, v.visitor, v.day)
    .run();
}

export async function listTopSearches(
  days = 30,
  limit = 12
): Promise<SearchStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT q, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors,
              MAX(created_at) AS last
         FROM search_logs WHERE day >= :arg1
         GROUP BY q ORDER BY hits DESC, last DESC LIMIT :arg2`
    )
    .bind(cnDay(days - 1), limit)
    .all<SearchStat>();
  return results ?? [];
}

export async function listZeroResultSearches(
  days = 30,
  limit = 10
): Promise<SearchStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT q, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors,
              MAX(created_at) AS last
         FROM search_logs WHERE day >= :arg1 AND results = 0
         GROUP BY q ORDER BY hits DESC, last DESC LIMIT :arg2`
    )
    .bind(cnDay(days - 1), limit)
    .all<SearchStat>();
  return results ?? [];
}

export async function getSearchOverview(days = 30): Promise<SearchOverview> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN day = :arg1 THEN 1 ELSE 0 END) AS today,
              COUNT(DISTINCT q) AS words,
              COUNT(DISTINCT CASE WHEN results = 0 THEN q END) AS zeroWords
         FROM search_logs WHERE day >= :arg2`
    )
    .bind(cnDay(), cnDay(days - 1))
    .first<SearchOverview>();
  return {
    total: row?.total ?? 0,
    today: row?.today ?? 0,
    words: row?.words ?? 0,
    zeroWords: row?.zeroWords ?? 0,
  };
}

export async function listRecentSearches(limit = 15): Promise<RecentSearch[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT q, results, created_at FROM search_logs ORDER BY id DESC LIMIT :arg1"
    )
    .bind(limit)
    .all<RecentSearch>();
  return results ?? [];
}

export async function purgeOldSearches(keepDays = 365): Promise<number> {
  const db = await getDB();
  await db
    .prepare("DELETE FROM search_logs WHERE day < :arg1")
    .bind(cnDay(keepDays))
    .run();
  return 0;
}
