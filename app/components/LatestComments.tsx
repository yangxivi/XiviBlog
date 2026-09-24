import Link from "next/link";
import type { SidebarComment } from "@/lib/comments";

/** 与「推荐阅读」同款的标题图标（对话气泡） */
function IconComment() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] shrink-0 text-[var(--brand)]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3C6.99 3 3 6.58 3 11c0 2.05.87 3.92 2.3 5.33-.11 1.02-.5 2.32-1.7 3.67 1.98-.2 3.55-.85 4.66-1.55.01-.01.02-.01.03-.02 1.2.4 2.5.62 3.71.62 5.01 0 9-3.58 9-8.05S17.01 3 12 3z" />
    </svg>
  );
}

/** 昵称取色，与评论区头像底色一致（同一昵称颜色稳定） */
function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function timeAgo(cn: string): string {
  const t = new Date(cn.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return cn.slice(0, 10);
  const diff = Math.max(0, Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return cn.slice(0, 10);
}

/**
 * 侧边栏「最新评论」模块：内容与开关由后台「站点设置 → 最新评论」配置。
 * 服务端渲染，数据由 <SiteAside> 取好后传入。
 */
export default function LatestComments({
  items,
  title = "最新评论",
  showAvatar = true,
  showPost = true,
  showTime = true,
  excerpt = 50,
}: {
  items: SidebarComment[];
  title?: string;
  showAvatar?: boolean;
  showPost?: boolean;
  showTime?: boolean;
  excerpt?: number;
}) {
  if (!items?.length) return null;

  return (
    <div className="rounded-2xl border border-[var(--c-border-2)] p-5">
      <h3 className="mb-6 flex items-center gap-1 border-b border-[var(--c-border-2)] pb-2 text-[1.1rem] font-semibold text-[var(--c-text)]">
        <IconComment />
        {title}
      </h3>

      <ul className="space-y-4">
        {items.map((c) => {
          const text = c.content.replace(/\s+/g, " ").trim();
          const short = text.length > excerpt ? text.slice(0, excerpt) + "…" : text;
          return (
            <li key={c.id} className="flex gap-2.5">
              {showAvatar && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full text-sm"
                  style={{ background: `hsl(${hueOf(c.nickname)} 70% 88%)` }}
                  title={c.nickname}
                >
                  {c.avatar || "🙂"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[0.9rem] font-medium text-[var(--c-text)]">
                    {c.nickname}
                  </span>
                  {showTime && (
                    <span className="shrink-0 text-xs text-[var(--c-text-3)]">
                      {timeAgo(c.created_at)}
                    </span>
                  )}
                </div>
                <Link
                  href={c.href}
                  title={text}
                  className="mt-0.5 block truncate text-[0.95rem] leading-[1.5] text-[var(--c-text-2)] transition-colors hover:text-[var(--brand-deep)]"
                >
                  {short}
                </Link>
                {showPost && (
                  <Link
                    href={c.href}
                    className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--c-text-3)] transition-colors hover:text-[var(--brand-deep)]"
                  >
                    <span className="text-[var(--brand)]">·</span>
                    <span className="truncate">{c.target}</span>
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
