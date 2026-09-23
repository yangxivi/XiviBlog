-- 置顶 + 定时发布
-- pinned     : 1 = 首页/列表置顶优先
-- publish_at : UTC 'YYYY-MM-DD HH:MM:SS'；留空表示立即发布。
--              采用「惰性发布」——前台查询时用 publish_at <= now 过滤，
--              不需要 cron 去改 status，幂等且零运维。
ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN publish_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts (pinned, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_publish_at ON posts (publish_at);
