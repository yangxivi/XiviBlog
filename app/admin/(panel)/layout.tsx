import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import AdminNav from "./admin-nav";
import AdminLogo from "../admin-logo";

export const metadata: Metadata = {
  title: {
    template: "%s | 后台管理",
    default: "后台管理",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const user = await getCurrentUser();
  const settings = await getSettings();

  return (
    <div className="flex h-dvh min-h-0 bg-[var(--c-page)]">
      {/* ── 左侧深色侧边栏（方案 A） ───────────────────────────────── */}
      <aside className="flex w-[220px] shrink-0 flex-col bg-[#1e293b] text-slate-300">
        {/* 品牌区：LOGO 与前台页头同源（LogoMark + logoText 设置） */}
        <div className="flex flex-col items-center border-b border-slate-700/60 px-4 py-5">
          <AdminLogo />
          <span className="mt-2 text-sm font-semibold text-white">曦微博客</span>
          <span className="text-[11px] text-slate-500">后台管理</span>
        </div>

        {/* 用户信息卡 */}
        <div className="mx-3 my-4 flex items-center gap-3 rounded-xl bg-slate-800/70 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)]">
            {(user?.name || user?.email || "X").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">
              {user?.name || "管理员"}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {user?.email || "兼容会话"}
            </p>
          </div>
        </div>

        {/* 导航分组 */}
        <nav className="flex-1 overflow-y-auto px-3 pb-2">
          <AdminNav />
        </nav>

        {/* 底部退出 */}
        <div className="border-t border-slate-700/60 p-3">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              退出登录
            </button>
          </form>
        </div>
      </aside>

      {/* ── 右侧内容区 ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
