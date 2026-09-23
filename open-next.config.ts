import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // 增量缓存：不配置时禁用 ISR，适合纯内容博客
  // 需要 ISR 时可再加 kv/ r2 缓存配置
});
