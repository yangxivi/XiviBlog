"use client";

import { useEffect, useRef, useState } from "react";
import { onMainScroll } from "./scrollContainer";

export type TocItemView = {
  id: string;
  html: string;
  text: string;
  level: 2 | 3;
};

/**
 * 文章目录（左侧吸顶）。
 * 纯链接部分由服务端渲染，脚本只负责滚动时高亮当前所在小节；
 * 即使脚本没跑起来，锚点跳转依然可用。
 */
export default function PostToc({ items }: { items: TocItemView[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  // 点击后到平滑滚动结束前，锁定高亮为被点的那一项（否则动画途中会一路跳着高亮）
  const lockUntil = useRef(0);

  useEffect(() => {
    const headings = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (!headings.length) return;

    // 判定线要落在「跳转落点」下方（落点 = 5rem，见 globals.css 的 scroll-margin-top），
    // 否则刚点完的那一项不会立刻高亮
    const LINE = 96;

    let raf = 0;
    const update = () => {
      raf = 0;
      if (Date.now() < lockUntil.current) return;
      // 取「已滚过判定线」的最后一个标题为当前小节
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= LINE) current = h.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // 2026-09-17 布局重构：滚动发生在 main 容器内，换滚动事件源即可，
    // 标题位置仍用 getBoundingClientRect（视口参照），判定线不变
    return onMainScroll(onScroll);
  }, [items]);

  if (!items.length) return null;

  // 以正文里实际出现的最浅层级为基准（只写了一级、或只写了二级标题时不至于整体缩进）
  const baseLevel = items.reduce((m, it) => Math.min(m, it.level), 3);

  return (
    <nav
      aria-label="文章目录"
      /* 2026-09-17 布局重构：页头已移出滚动容器，不再遮挡内容，
         吸顶偏移只需留一点呼吸感；max-h 扣掉页头高度留出余量 */
      className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pb-4"
    >
      <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--c-text-3)]">
        目录
      </p>
      <ul className="border-l border-[var(--c-border-2)]">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                title={it.text}
                onClick={() => {
                  setActive(it.id);
                  lockUntil.current = Date.now() + 900;
                }}
                className={[
                  "-ml-px block rounded-r-md border-l-2 py-1.5 pr-3 text-[13px] leading-5 transition",
                  it.level > baseLevel ? "pl-6" : "pl-3 font-medium",
                  on
                    ? "border-[var(--brand)] bg-[var(--c-brand-soft)] text-[var(--brand-deep)]"
                    : "border-transparent text-[var(--c-text-3)] hover:border-[var(--c-brand-border)] hover:bg-[var(--c-brand-tint)] hover:text-[var(--c-text)]",
                ].join(" ")}
              >
                <span className="line-clamp-2" dangerouslySetInnerHTML={{ __html: it.html }} />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
