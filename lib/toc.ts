/**
 * 从「已渲染的正文 HTML」里提取文章目录（h2 / h3）。
 *
 * 为什么不改 lib/markdown.ts：正文与后台实时预览共用同一份渲染器是硬约定
 * （改它会让后台预览也多出锚点 id）。这里只在正文页做一次后处理：
 * 给 h2/h3 补上锚点 id，同时抽出目录数据。
 *
 * 关于级别：编辑器里写 `#` 渲染成 h2、`##` 渲染成 h3（h1 留给文章标题），
 * 所以「一级标题 / 二级标题」在 HTML 里对应 h2 / h3。
 */

export type TocItem = {
  /** 锚点 id，形如 sec-3 */
  id: string;
  /** 标题的行内 HTML（已由渲染器转义，可直接内嵌显示） */
  html: string;
  /** 标题纯文本，用于 title 提示 */
  text: string;
  /** 2 = 文章一级标题，3 = 二级标题 */
  level: 2 | 3;
};

const ENTITY: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITY[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @returns html  补好锚点 id 的正文 HTML
 *          items 目录条目（按正文顺序）
 */
export function buildToc(html: string): { html: string; items: TocItem[] } {
  const items: TocItem[] = [];
  let n = 0;

  const withIds = (html || "").replace(
    /<h([23])>([\s\S]*?)<\/h\1>/g,
    (_m, lv: string, inner: string) => {
      n += 1;
      const id = `sec-${n}`;
      items.push({
        id,
        html: inner,
        text: plainText(inner),
        level: Number(lv) as 2 | 3,
      });
      return `<h${lv} id="${id}">${inner}</h${lv}>`;
    }
  );

  return { html: withIds, items };
}
