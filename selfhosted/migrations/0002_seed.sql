-- 把原有 3 篇文章迁移进 D1（幂等：slug 唯一，重复执行自动跳过）
INSERT OR IGNORE INTO posts (slug, title, excerpt, content, tag, status, created_at) VALUES
(
  'nextjs-on-cloudflare-workers',
  '把 Next.js 16 部署到 Cloudflare Workers',
  '用 OpenNext 适配层把 App Router 应用搬上边缘运行时，记录完整配置与踩坑点。',
  'Next.js 想在 Cloudflare 上跑起来，关键在于它默认产出的是 Node.js 服务，而 Workers 是 V8 隔离环境，没有完整的 Node API。OpenNext 做的事就是把 Next 的构建产物重新打包成 Workers 能识别的形态。

## 一、安装适配层

```
npm install --save-dev @opennextjs/cloudflare wrangler
```

## 二、wrangler 配置

```jsonc
{
  "name": "xivi-blog",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-09-09",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

nodejs_compat 这一项不能漏，它让 Workers 提供大部分 Node 内置模块的 polyfill，Next 的服务端代码依赖这些。

## 三、构建与部署

```
npx opennextjs-cloudflare build && npx wrangler deploy
```

> 踩坑提醒：如果项目里用了 next/font/google，国内网络下构建会卡在字体下载。改用系统字体栈最稳。',
  '部署',
  'published',
  '2026-09-09'
),
(
  'cloudflare-api-token-guide',
  '为什么我最终放弃了 wrangler login',
  'OAuth 登录有 2 分钟硬超时，国内网络下几乎必败。改用 API Token 后一次配好。',
  'wrangler login 走的是 OAuth 授权码模式：它会在本地起一个回调服务，然后等你去浏览器点 Allow。问题在于这个等待窗口只有两分钟，超时进程直接退出。

在国内访问 Cloudflare 控制台，光是页面加载就可能吃掉大半时间，等你点到 Allow，本地的回调服务早没人监听了 —— 浏览器会显示 ERR_EMPTY_RESPONSE，但授权码其实已经生成，只是没人接。

## 更稳的做法

去控制台生成一个 API Token，用环境变量喂给 wrangler，就没有超时这回事了：

```
export CLOUDFLARE_API_TOKEN=你的token
npx wrangler deploy
```

> Token 记得写进 .env 并加进 .gitignore，别跟着代码提交上去。',
  '踩坑',
  'published',
  '2026-09-08'
),
(
  'zero-cost-side-project-stack',
  '零成本跑一个个人项目的选型思路',
  '静态站、边缘函数、免费额度怎么搭配，才能既不花钱又不牺牲体验。',
  '个人项目的托管成本通常不是钱，而是维护精力。所以选型时我更看重「部署一次之后能忘掉」。

## 内容型站点

如果不需要服务端逻辑，静态托管是最优解：构建一次、全球分发、几乎不会挂。需要一点点动态能力时，再挂边缘函数补上。

## 需要 SSR 的情况

像博客这种既要 SEO 又想保留动态能力的场景，用适配层跑在 Workers 上是比较平衡的方案 —— 有服务端渲染，但不用养服务器。

> 判断标准很简单：这个东西半年不管会不会出问题？会，就换更简单的方案。',
  '选型',
  'published',
  '2026-09-07'
);
