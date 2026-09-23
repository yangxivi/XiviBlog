-- 编辑推荐（侧边栏「推荐阅读」）
-- recommended : 1 = 被站长选为推荐（全局最多 10 篇，名额在 API 层校验）
ALTER TABLE posts ADD COLUMN recommended INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_recommended ON posts (recommended, created_at);
