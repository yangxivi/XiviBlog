/**
 * 站点主题注册表。
 * 每个主题对应 globals.css 里的 `html[data-theme="<id>"]`（浅色）与
 * `html.dark[data-theme="<id>"]`（暗色）两组 CSS 变量定义。
 *
 * 这里是后台「主题切换」UI 用的元信息（名称 + 预览色），
 * 真实配色一律在 globals.css 里以变量形式定义，前端不写死颜色。
 *
 * 其中 memorial（纪念灰）除手动选择外，还会在国家公祭日被自动强制启用，
 * 见 lib/memorial.ts。
 */

export type ThemeMeta = {
  id: string;
  name: string;
  /** 预览用的品牌主色（浅色态） */
  brand: string;
  /** 预览用的品牌辅助色 */
  brand2: string;
  /** 品牌底色上的文字色 */
  ink: string;
  /** 一句话描述 */
  desc: string;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "meituan",
    name: "美团黄",
    brand: "#ffd000",
    brand2: "#ffa800",
    ink: "#111925",
    desc: "明亮暖黄，经典技术博客风",
  },
  {
    id: "wechat",
    name: "微信绿",
    brand: "#07c160",
    brand2: "#06ad56",
    ink: "#ffffff",
    desc: "清爽微信绿，干净耐看",
  },
  {
    id: "zhihu",
    name: "知乎蓝",
    brand: "#1772f6",
    brand2: "#0f5fd1",
    ink: "#ffffff",
    desc: "知乎同款蓝，理性专业",
  },
  {
    id: "tencent",
    name: "腾讯蓝",
    brand: "#0052d9",
    brand2: "#003eb3",
    ink: "#ffffff",
    desc: "深邃腾讯蓝，沉稳大气",
  },
  {
    id: "xiaohongshu",
    name: "小红书粉",
    brand: "#ff2442",
    brand2: "#e01f3d",
    ink: "#ffffff",
    desc: "小红书红，活泼吸睛",
  },
  {
    id: "purple",
    name: "优雅紫",
    brand: "#7c3aed",
    brand2: "#6d28d9",
    ink: "#ffffff",
    desc: "高级紫，气质独特",
  },
  {
    id: "cyan",
    name: "青柠绿",
    brand: "#06b6d4",
    brand2: "#0891b2",
    ink: "#ffffff",
    desc: "青蓝渐变，通透清凉",
  },
  {
    /**
     * 第八种主题：纪念灰。
     * 既可在后台手动选定，也会在国家公祭日由 layout.tsx 自动强制启用
     * （判定逻辑见 lib/memorial.ts，整站去色样式见 globals.css 的
     * html[data-memorial="1"]）。
     */
    id: "memorial",
    name: "纪念灰",
    brand: "#6b7280",
    brand2: "#4b5563",
    ink: "#ffffff",
    desc: "素灰沉静，公祭日整站致哀",
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

/** 校验主题 id 是否合法，非法回退默认主题 */
export function normalizeTheme(id: unknown): string {
  return typeof id === "string" && THEME_IDS.includes(id) ? id : "meituan";
}

export function getTheme(id: string): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
