"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "xivi-sidead-dismissed";

export default function SideAd() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <aside
      data-xivi-ui
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 min-[1800px]:block"
    >
      <div className="relative w-60 overflow-hidden rounded-2xl border border-[var(--c-brand-border)] bg-[var(--c-card)] shadow-lg">
        <button
          type="button"
          aria-label="关闭"
          onClick={dismiss}
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--c-fill)] text-[var(--c-text-3)] transition hover:bg-[var(--c-border-3)] hover:text-[var(--c-text-2)]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.41 6.29 6.3-6.3 6.29 1.42 1.42 6.29-6.3 6.3 6.3 1.41-1.42-6.3-6.29 6.3-6.3z" />
          </svg>
        </button>
        <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] px-5 py-4 text-[var(--brand-ink)]">
          <p className="text-xs font-medium opacity-90">曦微 AI · 每日推送</p>
          <h4 className="mt-1 text-base font-bold leading-snug">
            免费 AI 资源
            <br />
            与自动化技巧
          </h4>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs leading-5 text-[var(--c-text-3)]">
            公众号「曦微AI」每天整理最新免费积分、开源工具与实战脚本。
          </p>
          <Link
            href="/about"
            className="mt-3 block rounded-lg bg-[var(--brand)] py-2 text-center text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
          >
            了解更多 →
          </Link>
        </div>
      </div>
    </aside>
  );
}
