# XiviBlog v1.3.9 Release Notes

## 修复
- **仪表盘500错误**：修复Turbopack缓存问题导致的dashboard页面组件未编译进SSR的严重bug
- **头像onError错误**：将头像渲染逻辑抽成独立的客户端组件`comment-avatar.tsx`，修复服务端组件中传递事件处理器的编译错误
- **补全import**：修复CF版缺失的`import CommentAvatar`语句

## 技术细节
- handler.mjs现在正确包含所有dashboard函数（getStatsOverview, listDaily, countPublished等）
- 头像组件采用"有头像显示图片+加载失败兜底首字母"的双层渲染策略
- 清理策略：必须连带删除`.next/cache/turbopack`目录才能彻底清除缓存

## 验证
- CF部署版本：`d11dd3d3-8821-4713-9ddc-1f5ef1ea9582`
- 构建时间：2026-09-20T09:38:13Z
- handler.mjs大小：4643 KB，包含所有必要函数
