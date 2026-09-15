"use client";

import Link from "next/link";
import { useIsAdmin } from "./AdminContext";

/**
 * 登录态下显示一个纯文字「编辑」入口（无边框 / 无底色），点击直达对应后台编辑页。
 * 用于关于页、自定义页面等「站长可就地编辑」的场景。
 */
export default function AdminEditButton({
  href,
  label = "编辑",
}: {
  href: string;
  label?: string;
}) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--c-text-3)] transition hover:text-[var(--brand-deep)]"
      title={`${label}此页面`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      {label}
    </Link>
  );
}
