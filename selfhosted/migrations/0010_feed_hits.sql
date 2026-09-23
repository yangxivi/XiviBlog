-- RSS 抓取记录（「阅读数」）
-- 每次 /rss.xml 被拉取 = 一行。reader 是按 UA 归一化后的订阅器名称（Feedly / Inoreader / …）。
--
-- 为什么不并进 page_views：access 埋点会主动过滤爬虫 UA，
-- 而 RSS 阅读器的 UA 天生就长成爬虫（FeedlyBot、python-requests…），
-- 混在一起会让「浏览器访问量」和「订阅阅读量」两套口径互相污染。
CREATE TABLE IF NOT EXISTS feed_hits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT    NOT NULL DEFAULT '/rss.xml',
  reader     TEXT    NOT NULL DEFAULT '',
  ua         TEXT    NOT NULL DEFAULT '',
  visitor    TEXT    NOT NULL DEFAULT '',
  day        TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_day     ON feed_hits (day);
CREATE INDEX IF NOT EXISTS idx_feed_reader  ON feed_hits (reader, day);
CREATE INDEX IF NOT EXISTS idx_feed_visitor ON feed_hits (visitor, day);
