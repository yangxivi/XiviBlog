-- 自定义页面表（后台「页面管理」）：
-- 留言板 / 友链页 / 「关于本站」等独立单页，区别于按时间排序的文章。
-- slug 即 URL 别名：自定义页面按 /<slug> 直出（app/[slug]/page.tsx）；
-- slug=about 时由专属路由 app/about/page.tsx 优先读取渲染。
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  show_in_nav INTEGER NOT NULL DEFAULT 0,  -- 1 = 出现在顶部导航
  nav_order INTEGER NOT NULL DEFAULT 99,   -- 导航排序，越小越靠前
  allow_comments INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS pages_updated_at
AFTER UPDATE ON pages
BEGIN
  UPDATE pages SET updated_at = datetime('now') WHERE id = NEW.id;
END;
