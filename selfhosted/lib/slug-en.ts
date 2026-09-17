/**
 * 中文标题 → 英文 slug（自动翻译，免 API Key）
 *
 * 背景：slugify 保留中文时，URL 里会出现中文段（Workers 下 params 不自动解码，曾引发 404）。
 * 方案：创建文章时若生成的 slug 含中文，服务端调用免 Key 翻译端点把标题译成英文，
 * 再规范成 slug；全部端点失败时回落原逻辑（保留中文 slug，详情页已有解码兜底）。
 *
 * 端点回退链（均无需 Key；Cloudflare Workers 出口 IP 可能被部分端点限流，故多备几个）：
 *  1. Google translate gtx
 *  2. Google clients5（dict-chrome-ex 客户端）
 *  3. MyMemory 匿名 API（限额内免费）
 */

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\u{20000}-\u{2ebe1}]/u;

/** 是否包含汉字 */
export function hasCJK(s: string): boolean {
  return CJK_RE.test(s);
}

/** 英文 slug 规范：小写、仅保留字母数字与连字符，超长按完整单词截断 */
function baseSlugify(s: string): string {
  const joined = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (joined.length <= 60) return joined;
  const cut = joined.slice(0, 60);
  const lastDash = cut.lastIndexOf("-");
  // 在词边界截断，避免出现 "anniversary-eve" 这种切半的词（保留至少 20 字符）
  return lastDash > 20 ? cut.slice(0, lastDash) : cut;
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function viaGtx(text: string): Promise<string> {
  const j = (await fetchJson(
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=" +
      encodeURIComponent(text)
  )) as unknown[];
  const segs = j?.[0];
  if (!Array.isArray(segs)) throw new Error("bad shape");
  return segs
    .map((s) => (Array.isArray(s) ? String(s[0] ?? "") : ""))
    .join("")
    .trim();
}

async function viaClients5(text: string): Promise<string> {
  const j = (await fetchJson(
    "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=zh-CN&tl=en&q=" +
      encodeURIComponent(text)
  )) as unknown;
  // 返回形如 [["译文","zh-CN"]] 或 ["译文"]
  if (Array.isArray(j)) {
    const first = j[0];
    if (typeof first === "string") return first.trim();
    if (Array.isArray(first) && typeof first[0] === "string") return first[0].trim();
  }
  throw new Error("bad shape");
}

async function viaMyMemory(text: string): Promise<string> {
  const j = (await fetchJson(
    "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) +
      "&langpair=zh-CN|en"
  )) as { responseData?: { translatedText?: string } };
  const t = j?.responseData?.translatedText?.trim();
  if (!t) throw new Error("empty");
  return t;
}

/**
 * 中文 → 英文翻译，多端点依次尝试（免 Key 公开端点兜底）。
 * 全部失败返回空串，由调用方回落。
 * 注：CF 版多一个 Workers AI 端点（依赖 @opennextjs/cloudflare 的 AI 绑定），
 * selfhosted 不引入该依赖，仅用免 Key 公开端点。
 */
export async function translateToEn(text: string): Promise<string> {
  const q = text.slice(0, 300);
  for (const fn of [viaGtx, viaClients5, viaMyMemory]) {
    try {
      const out = await fn(q);
      if (out) return out;
    } catch {
      /* 尝试下一个端点 */
    }
  }
  return "";
}

/** 诊断：逐端点尝试并返回「端点名: 错误」列表（仅调试用） */
export async function debugEndpoints(text: string): Promise<string[]> {
  const q = text.slice(0, 300);
  const out: string[] = [];
  const names = ["gtx", "clients5", "mymemory"];
  const fns = [viaGtx, viaClients5, viaMyMemory];
  for (let i = 0; i < fns.length; i++) {
    try {
      const r = await fns[i](q);
      out.push(`${names[i]}: OK "${r.slice(0, 40)}"`);
    } catch (e) {
      out.push(`${names[i]}: ${String(e).slice(0, 90)}`);
    }
  }
  return out;
}

/**
 * 中文标题 → 英文 slug。
 * 无汉字或翻译失败返回 null，调用方回落到原有 slugify 行为。
 */
export async function englishSlugFromTitle(title: string): Promise<string | null> {
  if (!hasCJK(title)) return null;
  const en = await translateToEn(title);
  if (!en) return null;
  return baseSlugify(en) || null;
}
