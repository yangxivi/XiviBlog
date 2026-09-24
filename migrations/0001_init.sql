-- 博客主表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  content TEXT DEFAULT '',
  tag TEXT DEFAULT '随笔',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 更新时间自动维护触发器
CREATE TRIGGER IF NOT EXISTS posts_updated_at
AFTER UPDATE ON posts
BEGIN
  UPDATE posts SET updated_at = datetime('now') WHERE id = NEW.id;
END;
