"use client";

import { useEffect, useState } from "react";
import { useDockAboveFooter } from "./useDockAboveFooter";

/**
 * 返回顶部按钮（右下角，叠在主题切换按钮上方）。
 *
 * 与 ThemeToggle 保持完全相同的尺寸和样式，仅在滚动超过阈值后显示。
 * 页脚滚入视口时与主题按钮一起停靠在页脚上方，不压住页脚内容。
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const { docked, bottom } = useDockAboveFooter(1);

  useEffect(() => {
    const onScroll = () => {
      // 滚动超过 200px 时显示，避免首屏就占用注意力
      setVisible(window.scrollY > 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={backToTop}
      aria-label="返回顶部"
      title="返回顶部"
      className={`z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-card)] text-[var(--c-text-2)] shadow-lg transition hover:text-[var(--brand-deep)] hover:shadow-xl sm:h-11 sm:w-11 sm:right-6 ${
        docked ? "absolute right-4" : "fixed right-4"
      } ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={docked ? { bottom } : { bottom: "4.5rem" }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
