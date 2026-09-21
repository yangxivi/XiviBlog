"use client";

import type { ReactNode } from "react";

/**
 * 带固定 header 的页面容器
 */
export default function PageWithHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/* 固定 header：sticky 置顶，无底部间距 */}
      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center justify-between px-0">
        <h1 className="text-base font-semibold text-white pl-[2em]">{title}</h1>
        {action && <div className="mr-[-2em]">{action}</div>}
      </div>
      {/* 内容区 */}
      <div>{children}</div>
    </>
  );
}
