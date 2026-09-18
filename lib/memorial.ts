/**
 * 国家公祭日 / 重大纪念日判定。
 *
 * 用途：遇到重大国家公祭日（如九一八事变纪念日、南京大屠杀死难者国家公祭日）时，
 * 由 layout.tsx 把整站强制切到「纪念灰」主题（memorial），并向 <html> 输出
 * data-memorial="1"，由 globals.css 施加整站灰度滤镜（连图片一并去色）。
 *
 * 日期一律按**东八区**判定：Workers 运行在边缘节点、自托管版服务器也可能配 UTC，
 * 直接用本地时区会导致「北京时间刚过零点但站点还没变灰」。这里复用 lib/datetime.ts
 * 的 cnDay()，与站内其它时间逻辑保持同一套时区口径。
 *
 * 日期表可被后台设置覆盖：memorialDays 非空时**整体替换**内置表（语义明确，
 * 避免「想删掉某天却删不掉」）。
 */
import { cnDay } from "./datetime";

export type MemorialDay = {
  /** 公历 MM-DD */
  md: string;
  /** 纪念日名称 */
  name: string;
};

/** 与主题注册表 lib/themes.ts 中的 id 对应 */
export const MEMORIAL_THEME_ID = "memorial";

/**
 * 内置纪念日表（公历，固定日期）。
 * 只收录日期固定的国家级纪念日 / 公祭日；清明等农历节日日期逐年浮动，未纳入。
 */
export const MEMORIAL_DAYS: MemorialDay[] = [
  { md: "05-12", name: "汶川地震纪念日" },
  { md: "07-07", name: "七七事变纪念日" },
  { md: "08-15", name: "日本宣布无条件投降纪念日" },
  { md: "09-03", name: "中国人民抗日战争胜利纪念日" },
  { md: "09-18", name: "九一八事变纪念日" },
  { md: "09-30", name: "烈士纪念日" },
  { md: "10-25", name: "抗美援朝纪念日" },
  { md: "12-13", name: "南京大屠杀死难者国家公祭日" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 把用户输入的一个日期串解析成 MM-DD；非法返回 null */
function parseOne(raw: string): { md: string; name: string } | null {
  const text = raw.trim();
  if (!text) return null;
  // 支持 9-18 / 09-18 / 9/18 / 9.18，名称写在日期后面（空格、冒号或顿号分隔）
  const m = text.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[:：、\s]?\s*(.*)$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  return { md: `${pad(month)}-${pad(day)}`, name: m[3].trim() };
}

/**
 * 解析后台自定义日期串。
 * 分隔符支持换行、英文逗号、中文逗号、分号；每一项形如 `MM-DD` 或 `MM-DD 名称`。
 * 非法项直接丢弃（不抛错，避免一个手误让整站素灰逻辑失效）。
 */
export function parseMemorialDays(raw: unknown): MemorialDay[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const out: MemorialDay[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(/[\n,，;；]+/)) {
    const parsed = parseOne(piece);
    if (!parsed) continue;
    if (seen.has(parsed.md)) continue;
    seen.add(parsed.md);
    out.push({
      md: parsed.md,
      // 没写名称时优先沿用内置表里的名字，其次给个通用名
      name: parsed.name || MEMORIAL_DAYS.find((d) => d.md === parsed.md)?.name || "纪念日",
    });
  }
  return out;
}

/**
 * 生效的纪念日表：后台填了自定义日期就整体替换内置表，否则用内置表。
 */
export function resolveMemorialDays(custom?: unknown): MemorialDay[] {
  const parsed = parseMemorialDays(custom);
  return parsed.length ? parsed : MEMORIAL_DAYS;
}

/** 查某个 MM-DD 的纪念日名称（供后台回显用） */
export function memorialName(md: string): string {
  return MEMORIAL_DAYS.find((d) => d.md === md)?.name ?? "纪念日";
}

/**
 * 判断「今天」是否为纪念日。返回命中的那一天，未命中返回 null。
 * 以东八区为准。offsetDays 语义与 cnDay() 一致：正数表示往前回溯几天
 * （想预览「明天」传 -1）。
 */
export function memorialToday(custom?: unknown, offsetDays = 0): MemorialDay | null {
  const day = cnDay(offsetDays); // YYYY-MM-DD（东八区）
  const md = day.slice(5); // MM-DD
  return resolveMemorialDays(custom).find((d) => d.md === md) ?? null;
}
