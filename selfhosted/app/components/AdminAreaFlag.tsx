"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 后台标记同步：在 <html> 上维护 data-admin 属性，供 globals.css 隐藏前台
 * 页眉 / 公告条 / 页脚。首屏由 layout.tsx 的内联脚本打标记（无闪烁），
 * 这里负责 SPA 路由切换后同步——离开 /admin 时清除标记，前台页眉恢复。
 */
export default function AdminAreaFlag() {
  const pathname = usePathname();
  useEffect(() => {
    const el = document.documentElement;
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      el.setAttribute("data-admin", "true");
    } else {
      el.removeAttribute("data-admin");
    }
  }, [pathname]);
  return null;
}
