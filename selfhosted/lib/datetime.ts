/**
 * 纯日期时间工具（不依赖任何云端绑定，客户端组件可以安全引入）。
 *
 * 约定：数据库里 publish_at / created_at 一律是 SQLite 的 UTC 文本
 * `YYYY-MM-DD HH:MM:SS`；页面上的输入框用浏览器本地时间。
 */

/** 该文章是否还没到发布时间（后台用来标「定时中」） */
export function isScheduled(p: { status: string; publish_at: string }): boolean {
  if (p.status !== "published" || !p.publish_at) return false;
  return p.publish_at.replace(" ", "T") + "Z" > new Date().toISOString();
}

/** 任意来源的时间串 → UTC 'YYYY-MM-DD HH:MM:SS'；非法输入返回空串 */
export function normPublishAt(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.length === 16 ? `${s}:00` : s;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC 串 → <input type="datetime-local"> 需要的本地时间值 */
export function utcToLocalInput(utc: string): string {
  if (!utc) return "";
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local 的本地时间值 → UTC 串 */
export function localInputToUtc(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** 东八区日期字符串 YYYY-MM-DD，offsetDays 为往前推的天数 */
export function cnDay(offsetDays = 0): string {
  const d = new Date(Date.now() + 8 * 3600_000 - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** SQLite 的 UTC datetime 字符串 → 东八区可读文本（MM-DD HH:mm） */
export function cnTime(utc: string): string {
  if (!utc) return "";
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return utc;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
