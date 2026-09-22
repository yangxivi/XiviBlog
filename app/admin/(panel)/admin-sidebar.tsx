"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** WordPress 风格线条图标（24×24，currentColor） */
const ICONS: Record<string, ReactNode> = {
  posts: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  tags: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  pages: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  ),
  comments: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  nav: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  footer: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  ),
  announce: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  backup: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
};

const GROUPS = [
  {
    label: "概览",
    items: [
      { href: "/admin/dashboard", label: "仪表盘", icon: "dashboard" },
    ],
  },
  {
    label: "内容设置",
    items: [
      { href: "/admin/posts", label: "文章管理", icon: "posts" },
      { href: "/admin/tags", label: "分类管理", icon: "tags" },
      { href: "/admin/media", label: "媒体库", icon: "media" },
      { href: "/admin/pages", label: "页面管理", icon: "pages" },
    ],
  },
  {
    label: "互动设置",
    items: [
      { href: "/admin/comments", label: "留言评论", icon: "comments" },
      { href: "/admin/stats", label: "访问统计", icon: "stats" },
    ],
  },
  {
    label: "基础设置",
    items: [
      { href: "/admin/settings", label: "基础信息", exact: true, icon: "settings" },
      { href: "/admin/settings/nav", label: "导航菜单", icon: "nav" },
      { href: "/admin/settings/home", label: "首页模块", icon: "home" },
      { href: "/admin/settings/footer", label: "页脚设置", icon: "footer" },
      { href: "/admin/settings/engage", label: "公告友链", icon: "announce" },
      { href: "/admin/settings/ai", label: "AI 工具", icon: "ai" },
      { href: "/admin/backup", label: "数据备份", icon: "backup" },
    ],
  },
];

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
};

export default function AdminSidebar({
  logo,
}: {
  logo: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("xivi-admin-sb") === "1");
      const g = localStorage.getItem("xivi-admin-groups");
      if (g) setClosed(JSON.parse(g));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((v) => {
      const nv = !v;
      try {
        localStorage.setItem("xivi-admin-sb", nv ? "1" : "0");
      } catch {
        /* ignore */
      }
      return nv;
    });
  };

  const toggleGroup = (label: string) => {
    setClosed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem("xivi-admin-groups", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const renderLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center rounded-lg py-2 text-sm transition ${
        collapsed ? "justify-center px-0" : "gap-2.5 px-3"
      } ${
        isActive(item)
          ? "bg-[var(--brand)] text-[var(--brand-ink)] font-bold"
          : "text-white font-bold hover:bg-slate-800/60 hover:text-white"
      }`}
    >
      <span className="shrink-0">{ICONS[item.icon]}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return (
    <>
      {/* 移动端菜单按钮 */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e293b] text-white shadow md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-[#1e293b] text-slate-300 transition-transform duration-200 md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-[220px]"}`}
      >
      {/* 品牌区：LOGO 与文字横向并排；收起时居中，展开只显示「后台管理」主标题 */}
      <div
        className={`flex items-center border-b border-slate-700/60 h-14 ${
          collapsed ? "justify-center px-1" : "px-2"
        }`}
      >
        {logo}
        {!collapsed && (
          <span className="ml-2.5 text-base font-semibold text-white leading-none">
            后台管理
          </span>
        )}
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {collapsed ? (
          <div className="space-y-2">
            {GROUPS.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="my-1 border-t border-slate-700/40" />}
                <div className="space-y-1">{group.items.map(renderLink)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {GROUPS.map((group) => {
              const isClosed = !!closed[group.label];
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="mb-1 flex w-full items-center justify-between px-2 text-[13px] font-semibold text-slate-400 transition hover:text-slate-200"
                  >
                    <span>{group.label}</span>
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-3.5 w-3.5 transition-transform ${
                        isClosed ? "-rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {!isClosed && (
                    <div className="space-y-0.5">{group.items.map(renderLink)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* 底部：收起/展开 + 退出登录 */}
      <div className="space-y-1 border-t border-slate-700/60 p-2">
        <button
          type="button"
          onClick={() => { toggleCollapse(); }}
          title={collapsed ? "展开菜单" : "收起菜单"}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white font-bold transition hover:bg-slate-800/60 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
          {!collapsed && <span>收起菜单</span>}
        </button>
        <form action="/api/auth/logout" method="POST" onSubmit={async (e) => {
          e.preventDefault();
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
          window.location.href = '/admin/login';
        }}>
          <button
            type="submit"
            title="退出登录"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white font-bold transition hover:bg-slate-800/60 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>退出登录</span>}
          </button>
        </form>
      </div>
      </aside>
    </>
  );
}
