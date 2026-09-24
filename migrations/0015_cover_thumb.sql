-- 封面缩略图：列表 / 侧栏 / 推荐等小图场景使用，避免把原图 base64（几十 KB~上百 KB）
-- 内嵌进列表 HTML 与 RSC flight 数据，导致页面体积膨胀与流式插值破坏 hydration。
-- 空字符串表示未生成，列表查询回落 cover_image。
ALTER TABLE posts ADD COLUMN cover_thumb TEXT NOT NULL DEFAULT '';
