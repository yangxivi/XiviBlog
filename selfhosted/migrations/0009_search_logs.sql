-- 站内搜索词记录
-- 目的：看清访客在找什么 —— 尤其是「有搜索但没结果」的词，就是该写的内容。
-- 与 page_views 分开存：搜索词量小且需要按词聚合，混在一起会让路径榜单变脏。
CREATE TABLE IF NOT EXISTS search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT NOT NULL,
  results INTEGER NOT NULL DEFAULT 0,
  visitor TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 按词聚合（热门词 / 无结果词）
CREATE INDEX IF NOT EXISTS idx_search_q ON search_logs (q);
-- 按时间取最近记录 / 清理
CREATE INDEX IF NOT EXISTS idx_search_day ON search_logs (day);
