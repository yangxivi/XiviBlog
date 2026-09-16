-- 0018: 页面页眉字段 —— 页眉直接在「页面编辑器」里维护，不再放站点设置。
-- header_title 留空时前台回退页面标题（about 页回退站点名）。
ALTER TABLE pages ADD COLUMN header_title TEXT NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN header_tagline TEXT NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN header_desc TEXT NOT NULL DEFAULT '';

-- 把 about 页现有页眉文案写进新字段（仅当为空时）
UPDATE pages SET header_title = '曦微博客' WHERE slug = 'about' AND header_title = '';
UPDATE pages SET header_tagline = '用 AI 与自动化，把重复劳动交给机器' WHERE slug = 'about' AND header_tagline = '';
UPDATE pages SET header_desc = '这里记录做东西的过程 —— AI 应用、Windows 桌面工具、自动化脚本，以及各类部署实践。能自动化的绝不手动，能免费的绝不付费。' WHERE slug = 'about' AND header_desc = '';
