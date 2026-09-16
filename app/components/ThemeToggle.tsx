"use client";

import { useEffect, useState } from "react";
import { useDockAboveFooter } from "./useDockAboveFooter";

/**
 * 明暗主题切换按钮（右下角固定，两个悬浮按钮中最靠下的一个）。
 *
 * 说明：
 * - 图标显隐完全交给 CSS（html.dark 选择器），避免服务端/客户端水合不一致。
 * - 点击时写入 localStorage，下次访问由 layout 里的内联脚本在首屏绘制前恢复，不闪烁。
 * - 页脚滚入视口时停靠在页脚上方，不压住页脚内容（见 useDockAboveFooter）。
 */
export default function ThemeToggle() {
  const { docked, bottom } = useDockAboveFooter(0);

  const toggle = () => {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");

    root.classList.toggle("dark", next);
    // 仅切换瞬间开启颜色过渡，避免影响页面其他动画
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 320);

    try {
      localStorage.setItem("xivi-theme", next ? "dark" : "light");
    } catch {
      /* 隐私模式下忽略 */
    }
  };

  return (
    <button
      type="button"
      data-xivi-ui
      onClick={toggle}
      aria-label="切换明暗主题"
      title="切换明暗主题"
      className={`z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-card)] text-[var(--c-text-2)] shadow-lg transition hover:text-[var(--brand-deep)] hover:shadow-xl sm:h-11 sm:w-11 ${
        docked ? "absolute right-4 sm:right-6" : "fixed right-4 bottom-4 sm:bottom-6 sm:right-6"
      }`}
      style={docked ? { bottom } : undefined}
    >
      {/* 月亮：当前为浅色，点击进入暗色 */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="theme-icon-moon h-5 w-5"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      {/* 太阳：当前为暗色，点击回到浅色 */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="theme-icon-sun h-5 w-5"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    </button>
  );
}
