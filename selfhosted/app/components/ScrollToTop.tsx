"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 每次路由切换（或页面首次渲染）后，如果没有锚点 hash，
 * 立即把页面滚回最顶部。避免 Next.js/浏览器恢复上一次滚动位置。
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
