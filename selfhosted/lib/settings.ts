import { getDB } from "./db";
import { normalizeTheme } from "./themes";

/** 单个链接（内部以 / 开头，外部写完整 URL） */
export type LinkItem = { label: string; href: string };
/** 页脚的一栏链接分组 */
export type FooterColumn = { title: string; links: LinkItem[] };

/** 自定义轮播项：图片 / 标题 / 跳转链接都可以单独设置 */
export type CarouselSlide = {
  title: string;
  excerpt: string;
  badge: string;
  image: string;
  href: string;
};

export type CarouselConfig = {
  /** auto = 自动取最新文章；custom = 使用下面自定义列表 */
  mode: "auto" | "custom";
  /** auto 模式下取最新几篇（1-10） */
  count: number;
  /** 自动切换间隔（秒，2-30） */
  interval: number;
  slides: CarouselSlide[];
};

/** 侧边栏橱窗卡：样式 / 图片 / 角标 / 标题 / 副标题 / 链接都可配 */
export type PromoCard = {
  /**
   * 样式变体：
   * outline = 白底描边（带 LOGO）；plain = 白底描边·无LOGO；
   * brand = 品牌色渐变；dark = 深色；
   * meituan/wechat/zhihu/tencent/xiaohongshu/purple/cyan = 七种主题色实色卡（与品牌色、深色并列）
   */
  variant:
    | "outline"
    | "plain"
    | "brand"
    | "dark"
    | "meituan"
    | "wechat"
    | "zhihu"
    | "tencent"
    | "xiaohongshu"
    | "purple"
    | "cyan";
  badge: string;
  /** 主标题，支持换行（前台按行渲染） */
  title: string;
  subtitle: string;
  /** 可选图片：上传（内嵌）或外链地址，留空显示纯色卡 */
  image: string;
  href: string;
};

/** 全站公告条：页头下方的细条，可整体关闭 */
export type NoticeConfig = {
  enabled: boolean;
  text: string;
  /** 点击跳转地址，留空则只展示不可点 */
  href: string;
};

/** 友情链接（页脚单独一区展示） */
export type FriendLink = {
  name: string;
  href: string;
  /** 一句话说明，留空只显示站名 */
  desc: string;
};
/** 页脚品牌区二维码模块：最多 2 张，用于放公众号 / 客服 / 社群等二维码 */
export type QrItem = {
  /** 图片地址：可上传（自动压缩内嵌）或填外链 https:// 地址，留空则不显示 */
  image: string;
  /** 二维码下方的标题，如「公众号」「加微信」 */
  title: string;
};

/** 侧边栏「最新评论」模块（参照主流博客系统的“近期评论”组件） */
export type LatestCommentsConfig = {
  /** 是否在侧边栏显示 */
  enabled: boolean;
  /** 模块标题 */
  title: string;
  /** 展示条数（3-10） */
  count: number;
  /** 显示评论者头像（emoji 圆底） */
  showAvatar: boolean;
  /** 显示评论来自哪篇文章 / 页面 */
  showPost: boolean;
  /** 显示相对时间（如“3 小时前”） */
  showTime: boolean;
  /** 评论摘要最多显示多少字（30-120） */
  excerpt: number;
};

export type SiteSettings = {
  /** 站点名称（页头 / 页脚 / 标题后缀） */
  siteName: string;
  /** LOGO 方块里的字母 */
  logoText: string;
  /** 站点描述（页头下方 / 页脚品牌区 / SEO） */
  siteDesc: string;
  /** 顶部导航项 */
  nav: LinkItem[];
  /** 页脚品牌区描述 */
  footerBrand: string;
  /** 页脚链接分组 */
  footerColumns: FooterColumn[];
  /** 首页轮播配置 */
  carousel: CarouselConfig;
  /** 侧边栏橱窗位 */
  promos: PromoCard[];
  /** 版权行，支持 {year} 占位 */
  copyright: string;
  /** 版权行右侧备注 */
  footnote: string;
  /** 备案号（留空不显示） */
  icp: string;
  /** 全站公告条 */
  notice: NoticeConfig;
  /** 友情链接 */
  friends: FriendLink[];
  /** 页脚品牌区二维码模块（最多 2 张）：上传/外链图片 + 标题 */
  footerQr: QrItem[];
  /** 侧边栏「最新评论」模块 */
  latestComments: LatestCommentsConfig;
  /** 「关于」页标题（留空用默认） */
  aboutTitle: string;
  /** 「关于」页正文（Markdown，留空则用内置文案） */
  aboutContent: string;
  /** AI 封面 API Key；留空则尝试读取环境变量 AGNES_API_KEY / AI_COVER_API_KEY */
  aiCoverApiKey: string;
  /** AI 封面模型 ID（agnes 默认 blog） */
  aiCoverModel: string;
  /** AI 封面 API Base URL（末尾不带 /images/generations） */
  aiCoverBaseUrl: string;
  /** 分类英文别名：中文分类名 → 英文别名（/category/ 别名 URL 也会解析） */
  categoryAliases: Record<string, string>;
  /** 站点主题（品牌色方案）：meituan / wechat / zhihu / tencent / xiaohongshu / purple / cyan / memorial */
  theme: string;
  /** 自动检测更新：开启后后台访问时自动对比 GitHub 最新版本（静默、不自动安装） */
  autoUpdate: boolean;
};

export const SETTINGS_KEY = "site";

/**
 * 站点设置是高频读取、极少变更的数据（每次请求 layout / metadata / 页面都要读）。
 *
 * 注意：早期版本在这里做了一层「Worker isolate 内 60s 内存缓存」来省 D1 查询，
 * 但 Cloudflare Workers 会同时跑多个 isolate，每个 isolate 的内存缓存互不相通。
 * 在某个 isolate 上保存设置后，只刷新了那一台的缓存，其它 isolate 最多会滞后
 * 60s 才过期——表现就是「后台切换主题后刷新仍看到旧配色，得关掉浏览器等缓存
 * 过期才恢复」。因此这里改为**每次直读 D1**（D1 写入立即可见，跨 isolate 强一致），
 * 整页 HTML 已在边缘层缓存 60s，多这一次 D1 读取对性能几乎无影响，却换来了
 * 「改完立即全站生效」的正确性。
 */

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "曦微博客（XiviBlog）开源博客系统",
  logoText: "曦微",
  siteDesc:
    "曦微（XIVI）的技术博客：AI 应用、桌面工具、自动化脚本与部署实践。",
  nav: [
    { label: "首页", href: "/" },
    { label: "历史文章", href: "/history" },
    { label: "关于本站", href: "/about" },
  ],
  footerBrand: "记录 AI 应用、Windows 工具与自动化脚本的实践过程。能自动化的绝不手动。",
  footerColumns: [
    {
      title: "导航",
      links: [
        { label: "首页", href: "/" },
        { label: "历史文章", href: "/history" },
        { label: "关于本站", href: "/about" },
        { label: "后台管理", href: "/admin" },
      ],
    },
    {
      title: "资源",
      links: [
        { label: "AI 工具", href: "/?tag=AI工具" },
        { label: "Windows 工具", href: "/?tag=Windows" },
        { label: "自动化脚本", href: "/?tag=自动化" },
      ],
    },
    {
      title: "订阅",
      links: [
        { label: "AI 资源导航", href: "https://www.ixivi.cn" },
        { label: "关于曦微", href: "/about" },
      ],
    },
  ],
  copyright: "© {year} 曦微博客系统 XiviBlogSystem",
  footnote: "By [XiviBlog](https://blog.aixivi.cn/)",
  icp: "",
  notice: {
    enabled: false,
    text: "",
    href: "",
  },
  friends: [],
  footerQr: [
    { image: "", title: "" },
    { image: "", title: "" },
  ],
  latestComments: {
    enabled: true,
    title: "最新评论",
    count: 5,
    showAvatar: true,
    showPost: true,
    showTime: true,
    excerpt: 50,
  },
  aboutTitle: "关于这个博客",
  /** 留空时前台用内置文案，后台填了就完全以后台为准 */
  aboutContent: "",
  aiCoverApiKey: "",
  aiCoverModel: "agnes-image-2.0-flash",
  aiCoverBaseUrl: "https://apihub.agnes-ai.com/v1",
  /** AI 排版 API Key（默认与封面共用，留空则尝试读取环境变量） */
  aiFormatApiKey: "",
  /** AI 排版模型 ID（默认 glm-4.7-flash 免费） */
  aiFormatModel: "glm-4.7-flash",
  /** AI 排版 API Base URL（末尾不带 /v1） */
  aiFormatBaseUrl: "https://api.anthropic.com/v1",
  categoryAliases: {},
  theme: "meituan",
  autoUpdate: false,
  carousel: {
    mode: "auto",
    count: 5,
    interval: 5,
    slides: [],
  },
  promos: [
    {
      variant: "outline",
      badge: "",
      title: "CODE A BETTER LIFE",
      subtitle: "曦微博客系统 XiviBlogSystem · 技术笔记",
      image: "",
      href: "",
    },
    {
      variant: "brand",
      badge: "曦微 AI",
      title: "免费 AI 资源导航\n每日更新积分与工具",
      subtitle: "",
      image: "",
      href: "https://www.ixivi.cn",
    },
    {
      variant: "dark",
      badge: "实践笔记",
      title: "Next.js · Cloudflare\n从零部署合集",
      subtitle: "",
      image: "",
      href: "/history",
    },
  ],
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback: string, max = 300): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function normLinks(v: unknown, fallback: LinkItem[]): LinkItem[] {
  if (!Array.isArray(v)) return fallback;
  const out: LinkItem[] = [];
  for (const it of v) {
    if (!isObj(it)) continue;
    const label = str(it.label, "", 40);
    const href = str(it.href, "", 500);
    if (!label || !href) continue;
    out.push({ label, href });
    if (out.length >= 20) break;
  }
  return out.length ? out : fallback;
}

function normColumns(v: unknown, fallback: FooterColumn[]): FooterColumn[] {
  if (!Array.isArray(v)) return fallback;
  const out: FooterColumn[] = [];
  for (const it of v) {
    if (!isObj(it)) continue;
    const title = str(it.title, "", 30);
    const links = normLinks(it.links, []);
    if (!title) continue;
    out.push({ title, links });
    if (out.length >= 4) break;
  }
  return out.length ? out : fallback;
}

const PROMO_VARIANTS: PromoCard["variant"][] = [
  "outline",
  "plain",
  "brand",
  "dark",
  "meituan",
  "wechat",
  "zhihu",
  "tencent",
  "xiaohongshu",
  "purple",
  "cyan",
];

/** 侧边橱窗：丢掉没标题的项，最多 8 张（允许清空） */
/** 侧边橱窗：纯图片橱窗卡是合法场景（标题可空），仅当四项全空才视为废卡丢弃，最多 8 张（允许清空） */
function normPromos(v: unknown, fallback: PromoCard[]): PromoCard[] {
  if (!Array.isArray(v)) return fallback;
  const out: PromoCard[] = [];
  for (const it of v) {
    if (!isObj(it)) continue;
    const title = str(it.title, "", 120);
    const image = str(it.image, "", 2000000);
    const badge = str(it.badge, "", 30);
    const subtitle = str(it.subtitle, "", 120);
    // 标题可空：只放图的橱窗卡也要保留；仅全部为空才丢弃
    if (!title && !image && !badge && !subtitle) continue;
    out.push({
      variant: PROMO_VARIANTS.includes(it.variant as PromoCard["variant"])
        ? (it.variant as PromoCard["variant"])
        : "outline",
      badge,
      title,
      subtitle,
      image,
      href: str(it.href, "", 500),
    });
    if (out.length >= 8) break;
  }
  return out;
}

function normNotice(v: unknown, d: NoticeConfig): NoticeConfig {
  if (!isObj(v)) return { ...d };
  const text = str(v.text, "", 120);
  return {
    // 没有文案就没必要显示整条，直接视为关闭
    enabled: v.enabled === true && text.length > 0,
    text,
    href: str(v.href, "", 500),
  };
}

/** 友情链接：名称 + 地址必填，最多 24 条（允许清空） */
function normFriends(v: unknown, fallback: FriendLink[]): FriendLink[] {
  if (!Array.isArray(v)) return fallback;
  const out: FriendLink[] = [];
  for (const it of v) {
    if (!isObj(it)) continue;
    const name = str(it.name, "", 40);
    const href = str(it.href, "", 500);
    if (!name || !href) continue;
    out.push({ name, href, desc: str(it.desc, "", 80) });
    if (out.length >= 24) break;
  }
  return out;
}

/** 侧边栏最新评论：条数 3-10、摘要 30-120 字，开关缺省视为开启 */
/** 页脚二维码：上传（内嵌）或外链 + 标题，最多 2 张，始终补满 2 槽位 */
function normFooterQr(v: unknown, d: QrItem[]): QrItem[] {
  if (!Array.isArray(v)) return d;
  const out: QrItem[] = [];
  for (const it of v) {
    if (!isObj(it)) continue;
    out.push({
      image: str(it.image, "", 2000000),
      title: str(it.title, "", 40),
    });
    if (out.length >= 2) break;
  }
  while (out.length < 2) out.push({ image: "", title: "" });
  return out;
}

function normLatestComments(
  v: unknown,
  d: LatestCommentsConfig
): LatestCommentsConfig {
  if (!isObj(v)) return { ...d };
  return {
    enabled: v.enabled !== false,
    title: str(v.title, d.title, 30),
    count: clampInt(v.count, d.count, 3, 10),
    showAvatar: v.showAvatar !== false,
    showPost: v.showPost !== false,
    showTime: v.showTime !== false,
    excerpt: clampInt(v.excerpt, d.excerpt, 30, 120),
  };
}

function normSlides(v: unknown, fallback: CarouselSlide[]): CarouselSlide[] {
  if (!Array.isArray(v)) return fallback;
  const out: CarouselSlide[] = [];
  for (const it of v) {
    if (!isObj(it)) continue;
    out.push({
      title: str(it.title, "", 80),
      excerpt: str(it.excerpt, "", 160),
      badge: str(it.badge, "", 20),
      image: str(it.image, "", 2000000),
      href: str(it.href, "", 500),
    });
    if (out.length >= 10) break;
  }
  return out;
}

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normCarousel(v: unknown, d: CarouselConfig): CarouselConfig {
  if (!isObj(v)) return { ...d };
  return {
    mode: v.mode === "custom" ? "custom" : "auto",
    count: clampInt(v.count, d.count, 1, 10),
    interval: clampInt(v.interval, d.interval, 2, 30),
    slides: normSlides(v.slides, d.slides),
  };
}

/** 分类英文别名：丢掉空值 / 超长值，最多 50 条 */
function normCategoryAliases(v: unknown): Record<string, string> {
  if (!isObj(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    const key = k.trim().slice(0, 30);
    const alias = typeof val === "string" ? val.trim().slice(0, 60) : "";
    if (key && alias) out[key] = alias;
  }
  return out;
}

/** 用任意来源（数据库 / 请求体）覆盖默认设置，非法字段自动回退 */
export function normalizeSettings(input: unknown): SiteSettings {
  const d = DEFAULT_SETTINGS;
  if (!isObj(input)) return { ...d };
  return {
    siteName: str(input.siteName, d.siteName, 60),
    logoText: str(input.logoText, d.logoText, 6),
    siteDesc: str(input.siteDesc, d.siteDesc, 300),
    nav: normLinks(input.nav, d.nav),
    footerBrand: str(input.footerBrand, d.footerBrand, 300),
    footerColumns: normColumns(input.footerColumns, d.footerColumns),
    carousel: normCarousel(input.carousel, d.carousel),
    promos: normPromos(input.promos, d.promos),
    copyright: str(input.copyright, d.copyright, 120),
    footnote: str(input.footnote, d.footnote, 120),
    icp: str(input.icp, d.icp, 60),
    notice: normNotice(input.notice, d.notice),
    friends: normFriends(input.friends, d.friends),
    footerQr: normFooterQr(input.footerQr, d.footerQr),
    latestComments: normLatestComments(input.latestComments, d.latestComments),
    aboutTitle: str(input.aboutTitle, d.aboutTitle, 40),
    aboutContent: str(input.aboutContent, d.aboutContent, 20000),
    aiCoverApiKey: str(input.aiCoverApiKey, d.aiCoverApiKey, 200),
    aiCoverModel: str(input.aiCoverModel, d.aiCoverModel, 60),
    aiCoverBaseUrl: str(input.aiCoverBaseUrl, d.aiCoverBaseUrl, 200),
    aiFormatApiKey: str(input.aiFormatApiKey, d.aiFormatApiKey, 200),
    aiFormatModel: str(input.aiFormatModel, d.aiFormatModel, 60),
    aiFormatBaseUrl: str(input.aiFormatBaseUrl, d.aiFormatBaseUrl, 200),
    categoryAliases: normCategoryAliases(input.categoryAliases),
    // 用主题注册表校验：非法 id 回退默认主题，避免落库一个没有对应 CSS 变量的主题名
    theme: normalizeTheme(str(input.theme, d.theme, 20)),
    autoUpdate: input.autoUpdate === true,
  };
}

/**
 * 读取站点设置。任何异常（表未建、数据库不可用、构建期无绑定）
 * 都回退到默认值，保证前台永远不会因为设置读取失败而崩。
 */
export async function getSettings(): Promise<SiteSettings> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT value FROM settings WHERE key=?1")
      .bind(SETTINGS_KEY)
      .first<{ value: string }>();
    if (!row?.value) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * 兼容保留：设置改为每次直读 D1，不再维护 isolate 内内存缓存，
 * 保留空实现以避免破坏任何调用方（如构建脚本）。
 */
export function clearSettingsCache(): void {
  // no-op：当前实现每次都读 D1，无需清内存缓存
}

/** 保存设置（整体覆盖，返回规范化后的结果） */
export async function saveSettings(patch: unknown): Promise<SiteSettings> {
  const current = await getSettings();
  let p = isObj(patch) ? patch : {};
  // GET /api/settings 对所有请求（包括登录后台）都会把 aiCoverApiKey 脱敏成 "***" 回显，
  // 表单原样保存会把真实密钥覆盖成 "***"。这里把 "***" 视为「未修改」，回填库内真实值。
  if ((p as Record<string, unknown>).aiCoverApiKey === "***") {
    p = { ...p, aiCoverApiKey: current.aiCoverApiKey };
  }
  const merged = normalizeSettings({ ...current, ...p });
  const db = await getDB();
  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now')) " +
        "ON CONFLICT(key) DO UPDATE SET value=?2, updated_at=datetime('now')"
    )
    .bind(SETTINGS_KEY, JSON.stringify(merged))
    .run();
  return merged;
}
