"use client";

import { useState } from "react";
import type { NoticeConfig } from "@/lib/settings";

/**
 * 全站公告条。文案在后台「站点设置 → 公告条」维护。
 * 仅当后台开启且文案非空时显示；点击 ✕ 只隐藏当前这一次浏览，刷新后重新显示。
 */
export default function NoticeBar({ notice }: { notice: NoticeConfig }) {
  const [closed, setClosed] = useState(false);

  if (!notice.enabled || !notice.text || closed) return null;

  const body = (
    <span className="truncate">
      <span className="mr-1.5 font-semibold">公告</span>
      {notice.text}
      {notice.href && <span className="ml-1">→</span>}
    </span>
  );

  return (
    <div className="shrink-0 border-b border-[var(--c-brand-border)] bg-[var(--c-brand-tint)]">
      <div className="mx-auto flex max-w-[var(--page-outer)] items-center gap-3 px-6 py-2 text-sm text-[var(--brand-deep)]">
        {notice.href ? (
          <a
            href={notice.href}
            target={/^https?:\/\//i.test(notice.href) ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate transition hover:underline"
          >
            {body}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate">{body}</span>
        )}
        <button
          onClick={() => setClosed(true)}
          aria-label="关闭公告"
          title="关闭"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-[var(--brand-deep)] opacity-60 transition hover:bg-[var(--c-brand-soft-2)] hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
