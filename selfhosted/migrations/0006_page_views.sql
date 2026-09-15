-- 访问统计：一次页面浏览 = 一行
-- visitor 为 SHA256(应用盐 + IP + UA) 的截断值，用于算 UV。
-- 故意不加日期盐：跨天/跨月去重才准确（近 7 天 UV、累计 UV 不能重复计数）。
-- 不落库原始 IP，且带应用级盐，避免被彩虹表反查。
CREATE TABLE IF NOT EXISTS page_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT    NOT NULL,
  referrer   TEXT    NOT NULL DEFAULT '',
  ua         TEXT    NOT NULL DEFAULT '',
  visitor    TEXT    NOT NULL DEFAULT '',
  day        TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pv_day ON page_views (day);
CREATE INDEX IF NOT EXISTS idx_pv_path ON page_views (path);
CREATE INDEX IF NOT EXISTS idx_pv_visitor ON page_views (visitor, day);
CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views (created_at);
