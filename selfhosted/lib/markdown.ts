/**
 * 极简 Markdown 渲染器 —— 后台编辑器「实时预览」与前台正文页共用同一份实现，
 * 保证所见即所得；两边各写一份的话很容易出现预览能看、发出去变形的问题。
 *
 * 支持：标题(#/##/###) · 粗体 · 斜体 · 删除线 · 行内代码 · 代码块(```)
 *       链接 · 图片 · 引用(>) · 有序/无序列表 · 任务列表(- [ ])
 *       表格(| a | b |) · 分割线(---)
 *
 * 约定：`#` 渲染成 h2（h1 留给文章标题），与编辑器工具栏一致。
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 标签属性值转义（URL 里可能带 & 和引号） */
function attr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** 行内语法：图片 > 链接 > 行内代码 > 粗体/斜体/删除线 */
export function inlineMarkdown(s: string): string {
  // 先把「结构性」片段抽成占位符，避免内部字符被后续正则误伤
  const stash: string[] = [];
  const hold = (html: string) => `\u0001${stash.push(html) - 1}\u0001`;

  let t = s;

  // 图片 ![alt](url) —— 必须在链接之前处理
  t = t.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_m, alt: string, src: string) => {
    const safe = /^(https?:|data:image\/|\/)/i.test(src) ? src : "";
    if (!safe) return alt || "";
    return hold(`<img src="${attr(safe)}" alt="${attr(alt)}" loading="lazy" />`);
  });

  // 链接 [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_m, text: string, href: string) => {
    const safe = /^(https?:|\/|#|mailto:)/i.test(href) ? href : "#";
    return hold(
      `<a href="${attr(safe)}" target="_blank" rel="noopener noreferrer">${text}</a>`
    );
  });

  // 行内代码 `code`
  t = t.replace(/`([^`]+)`/g, (_m, code: string) => hold(`<code>${escapeHtml(code)}</code>`));

  // 删除线 / 粗体 / 斜体
  t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  t = t.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, "$1<em>$2</em>");

  // 还原占位符
  return t.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => stash[Number(i)] ?? "");
}

/** 表格分隔行：| --- | :--: | */
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** 表格行拆列 */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function renderMarkdown(raw: string): string {
  const lines = (raw || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  /** 无序 / 有序 / 任务列表 */
  const consumeList = (ordered: boolean) => {
    const items: string[] = [];
    // 任务列表与普通列表分开成两个 <ul>，避免普通项被去掉圆点
    const firstTask = /^\s*[-*]\s+\[[ xX]\]\s+/.test(lines[i]);
    while (i < lines.length) {
      const line = lines[i];
      if (ordered) {
        const m = line.match(/^\s*\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${inlineMarkdown(m[1])}</li>`);
        i++;
        continue;
      }
      const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
      if (firstTask) {
        if (!task) break;
        const done = task[1].toLowerCase() === "x";
        items.push(
          `<li class="task${done ? " done" : ""}">` +
            `<input type="checkbox" disabled${done ? " checked" : ""} />` +
            `<span>${inlineMarkdown(task[2])}</span></li>`
        );
        i++;
        continue;
      }
      if (task) break;
      const m = line.match(/^\s*[-*]\s+(.*)$/);
      if (!m) break;
      items.push(`<li>${inlineMarkdown(m[1])}</li>`);
      i++;
    }
    const tag = ordered ? "ol" : "ul";
    out.push(
      `<${tag}${!ordered && firstTask ? ' class="task-list"' : ""}>${items.join("")}</${tag}>`
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // ``` 代码块
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        code.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // 跳过结束的 ```
      out.push(
        `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${code.join(
          "\n"
        )}</code></pre>`
      );
      continue;
    }

    // 表格：当前行含 | 且下一行是分隔行
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      TABLE_SEP.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = head.map((c) => `<th>${inlineMarkdown(c)}</th>`).join("");
      const tbody = rows
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${inlineMarkdown(c)}</td>`).join("")}</tr>`
        )
        .join("");
      out.push(
        `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
      );
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length + 1, 6); // # -> h2
      out.push(`<h${level}>${inlineMarkdown(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineMarkdown(q.join(" "))}</blockquote>`);
      continue;
    }

    // 列表（任务列表优先）
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line) || /^\s*[-*]\s+/.test(line)) {
      consumeList(false);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      consumeList(true);
      continue;
    }

    // 分割线
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    // 段落（段内单换行 = soft break）
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      const l = lines[i];
      if (
        l.trimStart().startsWith("```") ||
        /^(#{1,6})\s+/.test(l) ||
        /^\s*>\s?/.test(l) ||
        /^\s*[-*]\s+/.test(l) ||
        /^\s*\d+\.\s+/.test(l)
      ) {
        break;
      }
      para.push(inlineMarkdown(l));
      i++;
    }
    if (para.length) out.push(`<p>${para.join("<br />")}</p>`);
    else i++; // 兜底，防止死循环
  }

  return out.join("");
}
