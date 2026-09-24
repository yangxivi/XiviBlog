import type { ReactNode } from "react";

/**
 * 区块标题：对齐参考站的 tab 样式——
 * 标题文字下方一条与文字同宽的 2px 黄色下划线，压在下边框上。
 * action 放右侧的「历史文章 →」这类链接。
 */
export default function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-[var(--c-border)]">
      <div className="flex gap-8">
        <span className="relative -mb-px inline-block py-[0.8rem] text-[1.1rem] font-semibold text-[var(--c-text)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[var(--brand)] after:content-['']">
          {children}
        </span>
      </div>
      {action && <div className="pb-3">{action}</div>}
    </div>
  );
}
