"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SKIP = /^\/(admin|api|_next)/;

/**
 * 前台访问埋点：路径变化时上报一次浏览。
 * - 走 sendBeacon（不阻塞渲染、关页面也能发出去），不支持时退回 fetch + keepalive
 * - 只记录「站外来源」，站内跳转的 referrer 记为空，避免来源榜被自家页面刷满
 * - 任何失败都静默，绝不影响访客
 */
export default function ViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP.test(pathname)) return;

    let referrer = "";
    try {
      if (document.referrer) {
        const from = new URL(document.referrer);
        if (from.origin !== window.location.origin) referrer = from.origin;
      }
    } catch {
      /* referrer 非法就当作直接访问 */
    }

    const payload = JSON.stringify({ path: pathname, referrer });

    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/track", blob)) return;
      }
    } catch {
      /* 走下面的 fetch */
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
