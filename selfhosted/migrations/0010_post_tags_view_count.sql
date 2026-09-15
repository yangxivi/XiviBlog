-- 文章列表卡片扩展：多标签 + 阅读数（列表页用子查询实时计算）
-- tags : 逗号分隔的附加标签，列表页取前 3 个展示
ALTER TABLE posts ADD COLUMN tags TEXT NOT NULL DEFAULT '';

-- 已有文章：把原 tag 同步进 tags，避免升级后标签空白
UPDATE posts SET tags = tag WHERE tags = '' AND tag != '';
