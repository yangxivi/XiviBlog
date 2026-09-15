import Link from "next/link";

const ITEMS = [
  { href: "/admin", label: "文章" },
  { href: "/admin/tags", label: "标签" },
  { href: "/admin/media", label: "媒体库" },
  { href: "/admin/stats", label: "访问统计" },
  { href: "/admin/comments", label: "留言评论" },
  { href: "/admin/pages", label: "页面管理" },
  { href: "/admin/settings", label: "站点设置" },
  { href: "/admin/backup", label: "备份" },
];

/** 后台统一导航，current 传当前路径 */
export default function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-1">
      {ITEMS.map((it) => {
        const active =
          it.href === "/admin"
            ? current === "/admin"
            : current.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                : "text-[var(--c-text-2)] hover:bg-[var(--c-card)]"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
