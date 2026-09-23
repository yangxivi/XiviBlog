/**
 * 版本历史：与运行环境无关的纯函数与类型（客户端组件可以安全引入）。
 * 涉及 D1 的读写放在 lib/db.ts，避免把云端绑定带进浏览器包。
 */

/** 单篇最多保留的版本数，超出时删最旧的 */
export const REVISION_LIMIT = 30;

/** 自动快照的合并窗口（分钟）：窗口内的连续自动保存合成一条 */
export const REVISION_MERGE_MINUTES = 10;

/** 列表用的版本摘要（不含正文，列表不需要拖着大字段） */
export type RevisionMeta = {
  id: number;
  post_id: number;
  title: string;
  note: string;
  status: string;
  words: number;
  created_at: string;
};

/** 单条版本的完整内容（预览 / 恢复用） */
export type RevisionRow = RevisionMeta & {
  excerpt: string;
  content: string;
  cover_image: string;
  tag: string;
};

/** 正文字数：与编辑器右下角口径一致（去掉所有空白字符） */
export function countWords(content: string): number {
  return content.replace(/\s/g, "").length;
}

/** 版本在列表里的标题：手动打点用 note，自动快照用时间 */
export function revisionLabel(r: RevisionMeta): string {
  return r.note || "自动快照";
}

/**
 * SQLite 的 UTC 串 → 相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前）。
 * 超过 30 天就直接显示日期，相对时间反而难读。
 */
export function relTime(utc: string, now = Date.now()): string {
  if (!utc) return "";
  const t = Date.parse(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return utc;
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(t + 8 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * 极轻量的行级差异统计，用来提示「这个版本和当前差多少」。
 * 不做逐字符 diff（正文是 Markdown，字符级差异噪音大），只比行集合的增减。
 */
export function diffHint(
  a: string,
  b: string
): { added: number; removed: number } {
  const la = a.split("\n").map((s) => s.trim()).filter(Boolean);
  const lb = b.split("\n").map((s) => s.trim()).filter(Boolean);
  const count = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const s of arr) m.set(s, (m.get(s) ?? 0) + 1);
    return m;
  };
  const ma = count(la);
  const mb = count(lb);
  let added = 0;
  let removed = 0;
  for (const [k, v] of mb) added += Math.max(0, v - (ma.get(k) ?? 0));
  for (const [k, v] of ma) removed += Math.max(0, v - (mb.get(k) ?? 0));
  return { added, removed };
}
