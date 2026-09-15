"use client";

import { useEffect, useState } from "react";

const GAP = 16; // 按钮与页脚之间的间距
const STEP = 56; // 两个按钮堆叠时的纵向间距（44~48 高度 + 间距）

/**
 * 当页脚进入视口底部时，把悬浮按钮从 fixed 切换为 absolute 并停靠在页脚上方，
 * 避免按钮压在页脚内容上；向上滚动离开页脚时无缝切回 fixed。
 *
 * stackIndex：0 表示最靠下（如主题切换），1 表示在其上方（如返回顶部）。
 */
export function useDockAboveFooter(stackIndex = 0) {
  const [docked, setDocked] = useState(false);
  const [bottom, setBottom] = useState(GAP);

  useEffect(() => {
    const footer = document.querySelector<HTMLElement>("footer");
    if (!footer) return;

    const update = () => {
      const fr = footer.getBoundingClientRect();
      const vh = window.innerHeight;
      // 页脚顶部一旦进入视口（fr.top < vh），就停靠；边界处与 fixed 位置重合，无跳动
      if (fr.top < vh) {
        setDocked(true);
        setBottom(fr.height + GAP + stackIndex * STEP);
      } else {
        setDocked(false);
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [stackIndex]);

  return { docked, bottom };
}
