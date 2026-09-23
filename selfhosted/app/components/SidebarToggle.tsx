"use client";

import { useEffect, useState } from "react";

const KEY = "xivi-sidebar";

/**
 * 侧边栏左右切换按钮。
 * 状态存到 <html data-sidebar="left|right">，并用 localStorage 持久化，
 * 刷新 / 跨页面保持一致（首屏无闪烁由 layout 里的内联脚本保证）。
 */
export default function SidebarToggle() {
  const [pos, setPos] = useState<"left" | "right">("right");

  useEffect(() => {
    const cur = document.documentElement.dataset.sidebar;
    if (cur === "left" || cur === "right") setPos(cur);
  }, []);

  function toggle() {
    const next: "left" | "right" = pos === "right" ? "left" : "right";
    setPos(next);
    document.documentElement.dataset.sidebar = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 隐私模式忽略 */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={pos === "right" ? "侧栏在右，点击换到左侧" : "侧栏在左，点击换到右侧"}
      aria-label="切换侧边栏左右位置"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--c-fill)] text-[var(--c-text-2)] transition hover:bg-[var(--c-brand-soft-2)] hover:text-[var(--brand-deep)]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        {pos === "right" ? (
          <line x1="15" y1="4" x2="15" y2="20" />
        ) : (
          <line x1="9" y1="4" x2="9" y2="20" />
        )}
      </svg>
    </button>
  );
}
