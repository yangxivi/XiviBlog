-- 文章版本历史
-- 每次保存（手动 / 自动）都会写一条快照；同一「写作会话」内的改动会被合并，
-- 避免 3 秒一次的自动保存把版本列表刷爆。
-- note 为空 = 自动快照；非空 = 手动打点或「恢复前自动备份」。
CREATE TABLE IF NOT EXISTS post_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  note TEXT NOT NULL DEFAULT '',
  words INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 取某篇的最新版本 / 列表，都是「post_id + id 倒序」，一个联合索引够用
CREATE INDEX IF NOT EXISTS idx_rev_post ON post_revisions (post_id, id DESC);
