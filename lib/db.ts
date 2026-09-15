import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cnDay } from "./datetime";
import {
  REVISION_LIMIT,
  REVISION_MERGE_MINUTES,
  countWords,
  type RevisionMeta,
  type RevisionRow,
} from "./revisions";

export type PostRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  /** 封面缩略图（320px 小图 base64），列表/侧栏展示用；空串回落 cover_image */
  cover_thumb: string;
  tag: string;
  /** 逗号分隔的附加标签（列表页取前 3 个展示） */
  tags: string;
  status: "draft" | "published";
  /** 1 = 置顶 */
  pinned: number;
  /** 1 = 站长推荐（侧边栏「推荐阅读」，全局最多 10 篇） */
  recommended: number;
  /** UTC 'YYYY-MM-DD HH:MM:SS'，空串 = 立即发布 */
  publish_at: string;
  created_at: string;
  updated_at: string;
  /** 子查询计算出的阅读数，仅列表页/详情页查询时附带 */
  view_count?: number;
};

export type PostMeta = Omit<PostRow, "content">;

/**
 * 「已上线」条件：published 且（未设定时 或 已到点）。
 * 定时发布不靠 cron 改 status，而是每次查询时判定，幂等、零运维。
 */
const LIVE = "status='published' AND (publish_at='' OR publish_at<=datetime('now'))";

/** 列表排序：置顶优先，其次按发布时间倒序 */
const ORDER = "ORDER BY pinned DESC, created_at DESC";

/** 日期时间工具统一放在 lib/datetime.ts（纯函数，客户端也能引） */
export {
  isScheduled,
  normPublishAt,
  utcToLocalInput,
  localInputToUtc,
  cnDay,
  cnTime,
} from "./datetime";

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB: D1Database }).DB;
  if (!db) throw new Error("D1 binding 'DB' 不可用");
  return db;
}

/**
 * 列表场景统一取封面缩略图（未生成时回落原图）。
 * 原因：列表 HTML / RSC flight 内嵌几十 KB 的原图 base64 会让页面膨胀到近 1MB，
 * 且流式渲染时 flight 数据可能插进未闭合的超长属性中间，破坏 hydration。
 * 文章详情页（getBySlug/getById）保持返回原图。
 */
const LIST_SELECT = `SELECT id, slug, title, excerpt, CASE WHEN cover_thumb != '' THEN cover_thumb ELSE cover_image END AS cover_image, tag, tags, status, pinned, recommended, publish_at, created_at, updated_at, (SELECT COUNT(*) FROM page_views WHERE page_views.path = '/blog/' || posts.slug) AS view_count FROM posts`;

/** 已发布文章（前台） */
export async function listPublished(): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} WHERE ${LIVE} ${ORDER}`)
    .all<PostMeta>();
  return results ?? [];
}

/**
 * 已发布文章（分页）：只取一页，避免把几百篇连同 base64 封面一次性塞进 RSC flight。
 * - category 非空时按分类过滤（侧栏「按分类」页用）。
 * - year 非空时按年份过滤（历史归档页用）。
 * - 列表页首屏只取第一页（约 30 篇），其余页由客户端按需拉 /api/posts。
 */
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

/**
 * 已发布过滤条件（分类 / 年份可选）。
 * 用 substr(created_at,1,4) 比较年份，避免 LIKE 前缀匹配的写法歧义。
 */
function liveFilter(
  category?: string,
  year?: string
): { where: string; binds: string[] } {
  const parts = [LIVE];
  const binds: string[] = [];
  if (category) {
    binds.push(category);
    parts.push(`tag=?${binds.length}`);
  }
  if (year) {
    binds.push(year);
    parts.push(`substr(created_at,1,4)=?${binds.length}`);
  }
  return { where: `WHERE ${parts.join(" AND ")}`, binds };
}

/** 已发布文章总数（分页用；可带分类 / 年份过滤） */
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

/** 各年份文章数（历史归档页的年份标签用；只回年份与数量，不拉封面） */
export async function listYearCounts(): Promise<{ y: string; n: number }[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT substr(created_at,1,4) AS y, COUNT(*) AS n FROM posts WHERE ${LIVE} GROUP BY y ORDER BY y DESC`
    )
    .all<{ y: string; n: number }>();
  return results ?? [];
}

/** 最新 n 篇（侧栏回落用，避免为取几条而全表拉取） */
export async function listLatest(n = 5): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} WHERE ${LIVE} ${ORDER} LIMIT ${Math.max(1, n)}`)
    .all<PostMeta>();
  return results ?? [];
}

/**
 * 轮播用原图（前 n 篇，按 id 返回；无封面为空串，由前端回落渐变）。
 * 列表接口的 cover_image 是缩略图别名（保证列表体积），轮播大图必须单独取原图。
 */
export async function listCoverMap(
  n: number
): Promise<Record<number, string>> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, cover_image FROM posts WHERE ${LIVE} ${ORDER} LIMIT ${Math.max(1, n)}`
    )
    .all<{ id: number; cover_image: string }>();
  const map: Record<number, string> = {};
  for (const r of results ?? []) map[r.id] = r.cover_image || "";
  return map;
}

/** 全部文章（后台） */
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
      `SELECT *, (SELECT COUNT(*) FROM page_views WHERE page_views.path = '/blog/' || posts.slug) AS view_count FROM posts WHERE slug=?1` +
        (includeDraft ? "" : ` AND ${LIVE}`)
    )
    .bind(slug)
    .first<PostRow>();
  return row ?? null;
}

export async function getById(id: number): Promise<PostRow | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      "SELECT *, (SELECT COUNT(*) FROM page_views WHERE page_views.path = '/blog/' || posts.slug) AS view_count FROM posts WHERE id=?1"
    )
    .bind(id)
    .first<PostRow>();
  return row ?? null;
}

export type Neighbor = { slug: string; title: string };

/** 上一篇 / 下一篇（按发布时间倒序） */
export async function getNeighbors(slug: string): Promise<{
  prev: Neighbor | null;
  next: Neighbor | null;
}> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT slug, title FROM posts WHERE ${LIVE} ${ORDER}`
    )
    .all<Neighbor>();
  const arr: Neighbor[] = results ?? [];
  const idx = arr.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? arr[idx - 1] : null,
    next: idx < arr.length - 1 ? arr[idx + 1] : null,
  };
}

export type TagCount = { tag: string; count: number };

/** 标签统计（仅已发布） */
export async function listTags(): Promise<TagCount[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT tag, COUNT(*) as count FROM posts WHERE ${LIVE} GROUP BY tag ORDER BY count DESC, tag ASC`
    )
    .all<TagCount>();
  return results ?? [];
}

/** 按分类（tag 字段）查询已发布文章 */
export async function listByCategory(category: string): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${LIST_SELECT} WHERE ${LIVE} AND tag=?1 ${ORDER}`)
    .bind(category)
    .all<PostMeta>();
  return results ?? [];
}

/* ============================ 编辑推荐 ============================ */

/** 侧边栏「推荐阅读」名额上限 */
export const RECOMMEND_LIMIT = 10;

/** 当前推荐中的文章（已发布优先展示，置顶/时间排序） */
export async function listRecommended(): Promise<PostMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `${LIST_SELECT} WHERE ${LIVE} AND recommended=1 ${ORDER} LIMIT ${RECOMMEND_LIMIT}`
    )
    .all<PostMeta>();
  return results ?? [];
}

/** 当前推荐数量（含草稿，后台名额校验用） */
export async function countRecommended(): Promise<number> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM posts WHERE recommended=1")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * 设置 / 取消单篇推荐。
 * - 设为推荐时校验 10 个名额上限（取消不受限）；
 * - 返回 null 表示成功，否则为错误信息。
 */
export async function setRecommend(id: number, on: boolean): Promise<string | null> {
  const db = await getDB();
  const post = await db
    .prepare("SELECT id, recommended FROM posts WHERE id=?1")
    .bind(id)
    .first<{ id: number; recommended: number }>();
  if (!post) return "文章不存在";

  if (!on) {
    if (!post.recommended) return null; // 幂等
    await db
      .prepare("UPDATE posts SET recommended=0, updated_at=datetime('now') WHERE id=?1")
      .bind(id)
      .run();
    return null;
  }

  if (post.recommended) return null; // 已是推荐，幂等
  const n = await countRecommended();
  if (n >= RECOMMEND_LIMIT) return `推荐名额已满（${RECOMMEND_LIMIT}/${RECOMMEND_LIMIT}），请先取消一篇`;
  await db
    .prepare("UPDATE posts SET recommended=1, updated_at=datetime('now') WHERE id=?1")
    .bind(id)
    .run();
  return null;
}

export type TagStat = { tag: string; total: number; published: number };

/** 标签统计（含草稿，后台用） */
export async function listTagStats(): Promise<TagStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT tag, COUNT(*) as total, SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published FROM posts GROUP BY tag ORDER BY total DESC, tag ASC"
    )
    .all<TagStat>();
  return results ?? [];
}

export type ArchiveItem = { month: string; count: number };
/** 按月归档统计 */
export async function listArchives(): Promise<ArchiveItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM posts WHERE ${LIVE} GROUP BY month ORDER BY month DESC`
    )
    .all<ArchiveItem>();
  return results ?? [];
}

/** 阅读时长估算（中文按 400 字/分钟） */
export function readingTime(content: string): string {
  const chars = content.replace(/\s/g, "").length;
  return Math.max(1, Math.round(chars / 400)) + " 分钟";
}

/* ============================ 访问统计 ============================ */

export type ViewRow = {
  path: string;
  referrer: string;
  ua: string;
  visitor: string;
  day: string;
};

/** 写入一次浏览（调用方自行 catch，埋点失败不能影响访客） */
export async function trackView(v: ViewRow): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "INSERT INTO page_views (path, referrer, ua, visitor, day) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(v.path, v.referrer, v.ua, v.visitor, v.day)
    .run();
}

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

/** 总览：一次查询拿全部口径，避免多次往返 */
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
         SUM(CASE WHEN day = ?1 THEN 1 ELSE 0 END)       AS todayPv,
         COUNT(DISTINCT CASE WHEN day = ?1 THEN visitor END) AS todayUv,
         SUM(CASE WHEN day >= ?2 THEN 1 ELSE 0 END)      AS weekPv,
         COUNT(DISTINCT CASE WHEN day >= ?2 THEN visitor END) AS weekUv,
         SUM(CASE WHEN day >= ?3 THEN 1 ELSE 0 END)      AS monthPv,
         COUNT(DISTINCT CASE WHEN day >= ?3 THEN visitor END) AS monthUv
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

export type DailyPoint = { day: string; pv: number; uv: number };

/** 近 N 天逐日走势（缺失的日期补 0，保证图表不断档） */
export async function listDaily(days = 30): Promise<DailyPoint[]> {
  const db = await getDB();
  const from = cnDay(days - 1);
  const { results } = await db
    .prepare(
      `SELECT day, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
       FROM page_views WHERE day >= ?1
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

export type PathStat = { path: string; pv: number; uv: number };

export async function listTopPaths(
  days = 30,
  limit = 10
): Promise<PathStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT path, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
       FROM page_views WHERE day >= ?1
       GROUP BY path ORDER BY pv DESC LIMIT ?2`
    )
    .bind(cnDay(days - 1), limit)
    .all<PathStat>();
  return results ?? [];
}

export type ReferrerStat = { referrer: string; pv: number };

export async function listTopReferrers(
  days = 30,
  limit = 8
): Promise<ReferrerStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT CASE WHEN referrer = '' THEN '(直接访问)' ELSE referrer END AS referrer,
              COUNT(*) AS pv
       FROM page_views WHERE day >= ?1
       GROUP BY referrer ORDER BY pv DESC LIMIT ?2`
    )
    .bind(cnDay(days - 1), limit)
    .all<ReferrerStat>();
  return results ?? [];
}

export type RecentHit = {
  path: string;
  referrer: string;
  created_at: string;
  ua: string;
};

export async function listRecentHits(limit = 20): Promise<RecentHit[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT path, referrer, created_at, ua FROM page_views
       ORDER BY id DESC LIMIT ?1`
    )
    .bind(limit)
    .all<RecentHit>();
  return results ?? [];
}

/** 按 slug 汇总文章浏览数（用于正文页/后台列表展示） */
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

/** 清理超过 keepDays 的明细（手动或定时调用，控制库体积） */
export async function purgeOldViews(keepDays = 180): Promise<number> {
  const db = await getDB();
  const r = await db
    .prepare("DELETE FROM page_views WHERE day < ?1")
    .bind(cnDay(keepDays))
    .run();
  return r.meta.changes ?? 0;
}

/* ============================ 版本历史 ============================ */

/** 打快照只需要这几个字段，不必传完整的 PostRow */
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

/**
 * 写入一条版本快照。
 * - 内容与最新版本完全相同 → 返回 null，不产生冗余版本；
 * - merge=true（自动保存）且最新版本也是自动快照且仍在合并窗口内 → 就地覆盖；
 * - 否则插入新版本，并裁掉超出上限的旧版本。
 */
export async function snapshotRevision(
  post: SnapshotSource,
  note = "",
  merge = false
): Promise<number | null> {
  const db = await getDB();
  const words = countWords(post.content);

  const latest = await db
    .prepare(
      "SELECT id, title, content, note, created_at FROM post_revisions WHERE post_id=?1 ORDER BY id DESC LIMIT 1"
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
             SET title=?1, excerpt=?2, content=?3, cover_image=?4, tag=?5,
                 status=?6, words=?7, created_at=datetime('now')
           WHERE id=?8`
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

  const r = await db
    .prepare(
      `INSERT INTO post_revisions
         (post_id, title, excerpt, content, cover_image, tag, status, note, words)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`
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
  return r.meta.last_row_id ?? null;
}

/** 只保留最新的 keep 条，其余删除（插入后调用，控制库体积） */
export async function pruneRevisions(
  postId: number,
  keep = REVISION_LIMIT
): Promise<number> {
  const db = await getDB();
  const r = await db
    .prepare(
      `DELETE FROM post_revisions
        WHERE post_id=?1
          AND id NOT IN (
            SELECT id FROM post_revisions WHERE post_id=?1 ORDER BY id DESC LIMIT ?2
          )`
    )
    .bind(postId, keep)
    .run();
  return r.meta.changes ?? 0;
}

/** 版本列表（不含正文，避免列表接口拖着几十份大正文） */
export async function listRevisions(
  postId: number,
  limit = REVISION_LIMIT
): Promise<RevisionMeta[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, post_id, title, note, status, words, created_at
         FROM post_revisions WHERE post_id=?1 ORDER BY id DESC LIMIT ?2`
    )
    .bind(postId, limit)
    .all<RevisionMeta>();
  return results ?? [];
}

/** 单个版本的完整内容 */
export async function getRevision(id: number): Promise<RevisionRow | null> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM post_revisions WHERE id=?1")
    .bind(id)
    .first<RevisionRow>();
  return row ?? null;
}

/** 删除一个版本（返回是否真的删掉了） */
export async function deleteRevision(id: number): Promise<boolean> {
  const db = await getDB();
  const r = await db
    .prepare("DELETE FROM post_revisions WHERE id=?1")
    .bind(id)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

/** 导出备份时一并带上（按文章分组不必要，平铺即可） */
export async function listAllRevisions(): Promise<RevisionRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT * FROM post_revisions ORDER BY post_id ASC, id ASC")
    .all<RevisionRow>();
  return results ?? [];
}

/* ============================ 站内搜索词 ============================ */

export type SearchLogRow = {
  q: string;
  results: number;
  visitor: string;
  day: string;
};

/** 写入一次搜索（调用方自行 catch，埋点失败不能影响访客） */
export async function trackSearch(v: SearchLogRow): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "INSERT INTO search_logs (q, results, visitor, day) VALUES (?1, ?2, ?3, ?4)"
    )
    .bind(v.q, v.results, v.visitor, v.day)
    .run();
}

export type SearchStat = {
  q: string;
  hits: number;
  visitors: number;
  last: string;
};

/** 热门搜索词 */
export async function listTopSearches(
  days = 30,
  limit = 12
): Promise<SearchStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT q, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors,
              MAX(created_at) AS last
         FROM search_logs WHERE day >= ?1
         GROUP BY q ORDER BY hits DESC, last DESC LIMIT ?2`
    )
    .bind(cnDay(days - 1), limit)
    .all<SearchStat>();
  return results ?? [];
}

/** 搜了但一篇都没命中的词 —— 最值得补内容的地方 */
export async function listZeroResultSearches(
  days = 30,
  limit = 10
): Promise<SearchStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT q, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors,
              MAX(created_at) AS last
         FROM search_logs WHERE day >= ?1 AND results = 0
         GROUP BY q ORDER BY hits DESC, last DESC LIMIT ?2`
    )
    .bind(cnDay(days - 1), limit)
    .all<SearchStat>();
  return results ?? [];
}

export type SearchOverview = {
  total: number;
  today: number;
  words: number;
  zeroWords: number;
};

export async function getSearchOverview(days = 30): Promise<SearchOverview> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN day = ?1 THEN 1 ELSE 0 END) AS today,
              COUNT(DISTINCT q) AS words,
              COUNT(DISTINCT CASE WHEN results = 0 THEN q END) AS zeroWords
         FROM search_logs WHERE day >= ?2`
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

export type RecentSearch = {
  q: string;
  results: number;
  created_at: string;
};

export async function listRecentSearches(limit = 15): Promise<RecentSearch[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT q, results, created_at FROM search_logs ORDER BY id DESC LIMIT ?1"
    )
    .bind(limit)
    .all<RecentSearch>();
  return results ?? [];
}

/** 搜索词明细比访问明细小得多，可以留更久 */
export async function purgeOldSearches(keepDays = 365): Promise<number> {
  const db = await getDB();
  const r = await db
    .prepare("DELETE FROM search_logs WHERE day < ?1")
    .bind(cnDay(keepDays))
    .run();
  return r.meta.changes ?? 0;
}
