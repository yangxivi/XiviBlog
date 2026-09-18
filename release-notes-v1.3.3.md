# v1.3.3

## 修复

- 修复全新安装后无文章、「关于本站」内容缺失的问题：将 `_seed_posts20.sql`（20 篇样本文章）和 `_seed_about.md`（完整版关于页文案，与 blog.aixivi.cn/about 同步）纳入安装包并随安装流程自动写入
- 修复更新检测时间显示为 UTC（比北京时间慢 8 小时）的问题（v1.3.2 曾尝试修复但本次确保生效）

## 变更

- `selfhosted/lib/version.ts` 版本号：1.3.2 → 1.3.3
- `selfhosted/.gitignore`：新增 `_seed_*.sql` 和 `_seed_*.md` 白名单，确保种子文件始终随版本发布
- 安装包内新增 `migrations/_seed_about.md`（6600+ 字符，含完整迭代时间轴至 2026-09-17）
- 安装包内新增 `migrations/_seed_posts20.sql`（20 篇样本文章，含封面缩略图）