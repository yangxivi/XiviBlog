-- 留言评论：page_key = 'about'（关于页留言）或 'post:<id>'（文章评论）。
-- 免注册：nickname/avatar 由系统生成（avatar 存 emoji），IP 只留哈希用于限频。
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_key, id);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments(ip_hash, created_at);
