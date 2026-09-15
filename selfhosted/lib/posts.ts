export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "quote"; text: string };

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tag: string;
  readingTime: string;
  blocks: Block[];
};

export const posts: Post[] = [
  {
    slug: "nextjs-on-cloudflare-workers",
    title: "把 Next.js 16 部署到 Cloudflare Workers",
    excerpt:
      "用 OpenNext 适配层把 App Router 应用搬上边缘运行时，记录完整配置与踩坑点。",
    date: "2026-09-09",
    tag: "部署",
    readingTime: "4 分钟",
    blocks: [
      {
        type: "p",
        text: "Next.js 想在 Cloudflare 上跑起来，关键在于它默认产出的是 Node.js 服务，而 Workers 是 V8 隔离环境，没有完整的 Node API。OpenNext 做的事就是把 Next 的构建产物重新打包成 Workers 能识别的形态。",
      },
      { type: "h2", text: "一、安装适配层" },
      {
        type: "code",
        lang: "bash",
        text: "npm install --save-dev @opennextjs/cloudflare wrangler",
      },
      { type: "h2", text: "二、wrangler 配置" },
      {
        type: "code",
        lang: "jsonc",
        text: `{
  "name": "xivi-blog",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-09-09",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}`,
      },
      {
        type: "p",
        text: "nodejs_compat 这一项不能漏，它让 Workers 提供大部分 Node 内置模块的 polyfill，Next 的服务端代码依赖这些。",
      },
      { type: "h2", text: "三、构建与部署" },
      {
        type: "code",
        lang: "bash",
        text: "npx opennextjs-cloudflare build && npx wrangler deploy",
      },
      {
        type: "quote",
        text: "踩坑提醒：如果项目里用了 next/font/google，国内网络下构建会卡在字体下载。改用系统字体栈最稳。",
      },
    ],
  },
  {
    slug: "cloudflare-api-token-guide",
    title: "为什么我最终放弃了 wrangler login",
    excerpt:
      "OAuth 登录有 2 分钟硬超时，国内网络下几乎必败。改用 API Token 后一次配好。",
    date: "2026-09-08",
    tag: "踩坑",
    readingTime: "3 分钟",
    blocks: [
      {
        type: "p",
        text: "wrangler login 走的是 OAuth 授权码模式：它会在本地起一个回调服务，然后等你去浏览器点 Allow。问题在于这个等待窗口只有两分钟，超时进程直接退出。",
      },
      {
        type: "p",
        text: "在国内访问 Cloudflare 控制台，光是页面加载就可能吃掉大半时间，等你点到 Allow，本地的回调服务早没人监听了 —— 浏览器会显示 ERR_EMPTY_RESPONSE，但授权码其实已经生成，只是没人接。",
      },
      { type: "h2", text: "更稳的做法" },
      {
        type: "p",
        text: "去控制台生成一个 API Token，用环境变量喂给 wrangler，就没有超时这回事了：",
      },
      {
        type: "code",
        lang: "bash",
        text: "export CLOUDFLARE_API_TOKEN=你的token\nnpx wrangler deploy",
      },
      {
        type: "quote",
        text: "Token 记得写进 .env 并加进 .gitignore，别跟着代码提交上去。",
      },
    ],
  },
  {
    slug: "zero-cost-side-project-stack",
    title: "零成本跑一个个人项目的选型思路",
    excerpt:
      "静态站、边缘函数、免费额度怎么搭配，才能既不花钱又不牺牲体验。",
    date: "2026-09-07",
    tag: "选型",
    readingTime: "5 分钟",
    blocks: [
      {
        type: "p",
        text: "个人项目的托管成本通常不是钱，而是维护精力。所以选型时我更看重「部署一次之后能忘掉」。",
      },
      { type: "h2", text: "内容型站点" },
      {
        type: "p",
        text: "如果不需要服务端逻辑，静态托管是最优解：构建一次、全球分发、几乎不会挂。需要一点点动态能力时，再挂边缘函数补上。",
      },
      { type: "h2", text: "需要 SSR 的情况" },
      {
        type: "p",
        text: "像博客这种既要 SEO 又想保留动态能力的场景，用适配层跑在 Workers 上是比较平衡的方案 —— 有服务端渲染，但不用养服务器。",
      },
      {
        type: "quote",
        text: "判断标准很简单：这个东西半年不管会不会出问题？会，就换更简单的方案。",
      },
    ],
  },
];

export function getPost(slug: string) {
  return posts.find((p) => p.slug === slug);
}
