"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PostMeta } from "@/lib/db";
import CoverThumb from "./CoverThumb";
import { useIsAdmin } from "./AdminContext";

const gradients = [
  "from-[var(--brand)] to-[var(--brand-2)]",
  "from-[#FFC700] to-[#FF8A00]",
  "from-[#FFB800] to-[#FF6B00]",
  "from-[#FFE066] to-[#FFB300]",
  "from-[#FFCC33] to-[#FF9500]",
];

function gradientFor(tag: string): string {
  let sum = 0;
  for (let i = 0; i < tag.length; i++) sum += tag.charCodeAt(i);
  return gradients[sum % gradients.length];
}

function formatViews(n?: number): string {
  if (typeof n !== "number") return "0";
  if (n >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, "") + "w";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function splitTags(raw: string): string[] {
  if (!raw.trim()) return [];
  const byComma = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (byComma.length) return byComma.slice(0, 3);
  return raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function IconCalendar() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px] opacity-60"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px] opacity-60"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px] opacity-60"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PostListItem({ post }: { post: PostMeta }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const tags = splitTags(post.tags);
  const category = post.tag || "随笔";

  const goCategory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/category/${encodeURIComponent(category)}`);
  };

  const goEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/admin/edit/${post.id}`);
  };

  return (
    <article className="border-b border-[var(--c-border)] py-3 last:border-0">
      <Link
        href={`/blog/${post.slug}`}
        className="group flex flex-col gap-4 rounded-lg p-3 transition-colors hover:bg-[var(--c-soft)] sm:flex-row sm:gap-8"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="mb-[0.3rem] flex items-start justify-between gap-3">
              <h3 className="text-[1.1rem] font-semibold leading-[1.4] text-[var(--c-text)] sm:text-[1.25rem]">
                {post.title}
              </h3>
              {isAdmin && post.id > 0 && (
                <button
                  type="button"
                  onClick={goEdit}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-[var(--c-text-3)] transition hover:text-[var(--brand-deep)]"
                  title="编辑此文章"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  编辑
                </button>
              )}
            </div>
            {post.excerpt && (
              <p className="mb-4 line-clamp-2 text-[0.9rem] leading-[1.6] text-[var(--c-text-2)] sm:line-clamp-1 sm:text-[0.95rem]">
                {post.excerpt}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.75rem] text-[var(--c-text-3)] sm:gap-x-5 sm:text-[0.8rem]">
            <button
              type="button"
              onClick={goCategory}
              className="group/cat flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-[var(--c-brand-soft)] hover:text-[var(--brand-deep)]"
              title={`查看「${category}」分类`}
            >
              <IconFolder />
              <span className="group-hover/cat:underline">{category}</span>
            </button>
            <span className="flex items-center gap-1">
              <IconCalendar />
              <time>{post.created_at.slice(0, 10)}</time>
            </span>
            <span className="flex items-center gap-1">
              <IconEye />
              <span>{formatViews(post.view_count)}</span>
            </span>
            {tags.length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-[var(--c-fill)] px-1.5 py-0.5 text-xs text-[var(--c-text-3)]"
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* 美团 .post-image：固定 150×100、圆角 8px */}
        <div className="order-1 aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-[var(--c-soft)] sm:order-none sm:h-[100px] sm:w-[150px]">
          {post.cover_image ? (
            <CoverThumb
              src={post.cover_image}
              className="h-full w-full"
              imgClassName="transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(
                tags[0] || category
              )} text-sm font-bold text-[var(--c-text-2)]`}
            >
              {(tags[0] || category).slice(0, 2)}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
