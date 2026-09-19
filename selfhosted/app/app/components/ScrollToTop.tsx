"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getMainScroller } from "./scrollContainer";

/**
 * 每次路由切换（或页面首次渲染）后，如果没有锚点 hash，
 * 立即把页面滚回最顶部。避免 Next.js/浏览器恢复上一次滚动位置。
 * 2026-09-17 布局重构：滚动发生在 main#xivi-main 容器内，重置它（window 一并兜底）。
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      const el = getMainScroller();
      if (el) el.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
