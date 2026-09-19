修复：移除 selfhosted 对 @opennextjs/cloudflare 的残留引用

lib/slug-en.ts 中「中文标题自动翻译英文 slug」功能携带了 CF Workers 专属的
Workers AI 翻译端点（viaWorkersAI），其动态 import("@opennextjs/cloudflare")
在自托管环境构建时无法解析，导致 npm run build 直接失败。

本次改动：
- 删除 viaWorkersAI 端点及其依赖引用
- slug 翻译保留三个免 Key 公开端点：Google gtx / clients5 / MyMemory
  （自托管服务器直连，无 Workers 出口 IP 限流问题）
- Cloudflare 版不受影响，Workers AI 端点保留

升级方式：解压覆盖后重新 npm install && npm run build（依赖无变化，可跳过 install）
