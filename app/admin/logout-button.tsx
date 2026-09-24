"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // 整页跳转：清掉客户端路由缓存，避免残留「已登录」的页面结果
    window.location.replace("/admin/login");
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="rounded-lg border border-[var(--c-border-3)] px-3 py-2 text-sm text-[var(--c-text-3)] transition hover:border-[var(--c-border-3)] hover:text-[var(--c-text-2)]"
    >
      退出
    </button>
  );
}
