"use client";

import type { ReactNode } from "react";

/**
 * 带固定 header 的页面容器
 * - header: sticky 置顶在滚动容器内，始终可见
 * - content: 正常滚动
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
      {/* 固定 header：sticky 置顶在滚动容器顶部 */}
      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center justify-between px-6">
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {action && <div>{action}</div>}
      </div>
      {/* 内容区 */}
      <div>{children}</div>
    </>
  );
}
