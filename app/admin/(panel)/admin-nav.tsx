"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "内容",
    items: [
      { href: "/admin/posts", label: "文章管理" },
      { href: "/admin/tags", label: "分类管理" },
      { href: "/admin/media", label: "媒体库" },
      { href: "/admin/pages", label: "页面管理" },
    ],
  },
  {
    label: "互动",
    items: [
      { href: "/admin/comments", label: "留言评论" },
      { href: "/admin/stats", label: "访问统计" },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/admin/settings", label: "基础信息", exact: true },
      { href: "/admin/settings/nav", label: "导航菜单" },
      { href: "/admin/settings/home", label: "首页模块" },
      { href: "/admin/settings/footer", label: "页脚设置" },
      { href: "/admin/settings/engage", label: "公告与友链" },
      { href: "/admin/settings/ai", label: "AI 工具" },
      { href: "/admin/backup", label: "数据备份" },
    ],
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
