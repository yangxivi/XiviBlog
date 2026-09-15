"use client";

import { useEffect } from "react";

/**
 * 页脚滚动锁：把视口底边硬性限制在页脚最下边框，
 * 任何情况下（内容高度突变、缩放、滚动链、惯性越界）都不允许再往下滑出空白。
 *
 * 实现：监听 scroll / resize / 内容高度变化（ResizeObserver），
 * 一旦发现 scrollY + 视口高 > 页脚底边，立即夹回（rAF 合帧，无抖动）。
 */
export default function ScrollLock() {
  useEffect(() => {
    let raf = 0;

    const clamp = () => {
      raf = 0;
      const footers = document.querySelectorAll("footer");
      const f = footers[footers.length - 1];
      if (!f) return;
      const footerBottom =
        f.getBoundingClientRect().bottom + window.scrollY;
      // 浏览器实际能滚到的最底部（scrollHeight 向上取整，天然比页脚底边多 0~1px 亚像素）
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      // 夹回目标取两者较小值：绝不与浏览器的亚像素极限较劲
      const limit = Math.max(
        0,
        Math.min(maxScroll, footerBottom - window.innerHeight)
      );
      // 容差 2px：scrollHeight 取整造成的 ≤1px 亚像素差不算越界，
      // 否则滚到底会触发夹回，配合 smooth 滚动表现为「到底弹跳」。
      if (window.scrollY > limit + 2) {
        window.scrollTo({ top: limit, behavior: "instant" });
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(clamp);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // 内容高度变化（图片懒加载、翻页、公告显隐等）后重新夹紧
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    clamp();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, []);

  return null;
}
