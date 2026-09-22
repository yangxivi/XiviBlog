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
      {/* 内容区 */}
      <div>{children}</div>
    </>
  );
}
