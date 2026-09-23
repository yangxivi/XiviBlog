import { getDB } from "./db";
import { cnDay } from "./datetime";

/* ==========================================================================
 * RSS 抓取（阅读数）
 * ========================================================================== */

/** 匿名指纹：应用盐 + IP + UA 的 SHA-256 截断（不落库原始 IP） */
export async function visitorHash(scope: string, ip: string, ua: string): Promise<string> {
  const data = new TextEncoder().encode(`${scope}|${ip}|${ua}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf).slice(0, 10))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 按 UA 认人：RSS 阅读器的 UA 五花八门，但绝大多数都带自家域名或客户端标识。
 * 顺序敏感 —— 先具体后笼统，最后才是浏览器/未知。
 */
const READERS: [RegExp, string][] = [
  [/feedly/i, "Feedly"],
  [/inoreader/i, "Inoreader"],
  [/newsblur/i, "NewsBlur"],
  [/feedspot/i, "Feedspot"],
  [/theoldreader/i, "The Old Reader"],
  [/miniflux/i, "Miniflux"],
  [/freshreader|freshrss/i, "FreshRSS"],
  [/netnewswire/i, "NetNewsWire"],
  [/reeder/i, "Reeder"],
  [/readkit/i, "ReadKit"],
  [/folo\.?(island)?/i, "Folo"],
  [/rssguard/i, "RSS Guard"],
  [/akregator/i, "Akregator"],
  [/thunderbird/i, "Thunderbird"],
  [/netvibes/i, "Netvibes"],
  [/bazqux/i, "BazQux"],
  [/tiny ?tiny ?rss/i, "Tiny Tiny RSS"],
  [/zhuaxia|抓虾/i, "抓虾"],
  [/foxmail/i, "Foxmail"],
  [/wechat|weixin|micromessenger/i, "微信内置"],
  [/rss|atom|feedparser|feedfetcher|feedbot|xml-?reader/i, "RSS 阅读器（其他）"],
  [/google-?(read|feed)|greader/i, "Google Reader 类"],
  [/python|node-fetch|axios|undici|go-http-client|okhttp|java|curl|wget|libwww/i, "程序抓取"],
  [/mozilla|chrome|cran|safari|edg\/|firefox/i, "浏览器直接打开"],
];

export function detectReader(ua: string): string {
  const s = (ua || "").slice(0, 300).trim();
  if (!s) return "未知（无 UA）";
  for (const [re, name] of READERS) if (re.test(s)) return name;
  return "其他";
}

export type FeedHitRow = {
  path: string;
  reader: string;
  ua: string;
  visitor: string;
  day: string;
};

/** 写入一次抓取（调用方自行 catch：埋点失败不能影响 feed 本身） */
export async function trackFeedHit(v: FeedHitRow): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "INSERT INTO feed_hits (path, reader, ua, visitor, day) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(v.path, v.reader, v.ua, v.visitor, v.day)
    .run();
}

export type FeedOverview = {
  total: number;
  today: number;
  week: number;
  month: number;
  /** 近 30 天出现过的阅读器种数 */
  readers: number;
  /** 近 30 天独立读者数（IP+UA 去重，同一读者换网络会重复计数） */
  visitors: number;
  lastAt: string;
};

export async function getFeedOverview(days = 30): Promise<FeedOverview> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT COUNT(*)                                                AS total,
              SUM(CASE WHEN day = ?1 THEN 1 ELSE 0 END)                AS today,
              SUM(CASE WHEN day >= ?2 THEN 1 ELSE 0 END)               AS week,
              SUM(CASE WHEN day >= ?3 THEN 1 ELSE 0 END)               AS month,
              COUNT(DISTINCT CASE WHEN day >= ?3 THEN reader END)      AS readers,
              COUNT(DISTINCT CASE WHEN day >= ?3 THEN visitor END)     AS visitors,
              MAX(created_at)                                          AS lastAt
         FROM feed_hits`
    )
    .bind(cnDay(), cnDay(6), cnDay(days - 1))
    .first<FeedOverview>();
  return {
    total: row?.total ?? 0,
    today: row?.today ?? 0,
    week: row?.week ?? 0,
    month: row?.month ?? 0,
    readers: row?.readers ?? 0,
    visitors: row?.visitors ?? 0,
    lastAt: row?.lastAt ?? "",
  };
}

export type FeedDay = { day: string; hits: number; visitors: number };

/** 近 N 天逐日走势（缺失日期补 0，图表不断档） */
export async function listFeedDaily(days = 30): Promise<FeedDay[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT day, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors
         FROM feed_hits WHERE day >= ?1
         GROUP BY day ORDER BY day ASC`
    )
    .bind(cnDay(days - 1))
    .all<FeedDay>();

  const map = new Map((results ?? []).map((r) => [r.day, r]));
  const out: FeedDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = cnDay(i);
    out.push(map.get(d) ?? { day: d, hits: 0, visitors: 0 });
  }
  return out;
}

export type ReaderStat = {
  reader: string;
  hits: number;
  visitors: number;
  last: string;
};

export async function listTopReaders(days = 30, limit = 10): Promise<ReaderStat[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT reader, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors,
              MAX(created_at) AS last
         FROM feed_hits WHERE day >= ?1
         GROUP BY reader ORDER BY hits DESC, last DESC LIMIT ?2`
    )
    .bind(cnDay(days - 1), limit)
    .all<ReaderStat>();
  return results ?? [];
}

export type RecentFeedHit = {
  reader: string;
  ua: string;
  path: string;
  created_at: string;
};

export async function listRecentFeedHits(limit = 15): Promise<RecentFeedHit[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT reader, ua, path, created_at FROM feed_hits ORDER BY id DESC LIMIT ?1"
    )
    .bind(limit)
    .all<RecentFeedHit>();
  return results ?? [];
}

export async function purgeOldFeedHits(keepDays = 365): Promise<number> {
  const db = await getDB();
  const r = await db
    .prepare("DELETE FROM feed_hits WHERE day < ?1")
    .bind(cnDay(keepDays))
    .run();
  return r.meta.changes ?? 0;
}
