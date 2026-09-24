"use client";

import { useEffect, useState } from "react";

type Check = {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  checkedAt: string;
  error?: string;
};

export default function UpdatePanel() {
  const [check, setCheck] = useState<Check | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(force = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/update${force ? "?force=1" : ""}`);
      const j = await res.json() as Check;
      setCheck(j);
    } catch {
      setCheck({ current: "1.3.19", latest: null, hasUpdate: false, checkedAt: "", error: "检查失败" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const ghReleaseUrl = "https://github.com/yangxivi/XiviBlog/releases";

  return (
    <div className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--c-text)]">系统更新</h2>
          <p className="mt-1 text-sm text-[var(--c-text-3)]">
            Cloudflare Workers 版本不支持自动更新。请手动下载最新发布包并重新部署。
          </p>
        </div>
        <span className="rounded-full border border-[var(--c-border-3)] px-3 py-1 text-xs text-[var(--c-text-2)]">
          当前版本 v{check?.current ?? "…"}
        </span>
      </div>

      {/* 检测结果 */}
      <div className="mt-4 rounded-lg border border-[var(--c-border-2)] bg-[var(--c-soft)] p-4 text-sm">
        {check?.error ? (
          <span className="text-red-500">{check.error}</span>
        ) : check ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              最新版本：
              <b className="text-[var(--c-text)]">{check.latest ?? "未知"}</b>
            </span>
            <span className={check.hasUpdate ? "text-[var(--brand-deep)]" : "text-[var(--c-text-3)]"}>
              {check.hasUpdate
                ? "🔔 有可用更新"
                : check.latest
                ? "✓ 已是最新"
                : "GitHub 无法访问"}
            </span>
            <span className="text-xs text-[var(--c-text-3)]">
              检测于 {check.checkedAt?.slice(0, 19) || "—"}
            </span>
          </div>
        ) : (
          <span className="text-[var(--c-text-3)]">尚未检测</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="rounded-lg border border-[var(--c-border-3)] px-4 py-2 text-sm font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] disabled:opacity-40"
        >
          检查更新
        </button>
        <a
          href={ghReleaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
        >
          前往 GitHub Releases
        </a>
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-[var(--c-border-3)] p-4">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">如何更新</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[var(--c-text-2)]">
          <li>点击「前往 GitHub Releases」下载最新 Release（含完整源码）</li>
          <li>本地运行 <code className="rounded bg-[var(--c-fill)] px-1.5 py-0.5 text-xs font-mono text-[var(--c-text)]">git pull origin main</code></li>
          <li>执行 <code className="rounded bg-[var(--c-fill)] px-1.5 py-0.5 text-xs font-mono text-[var(--c-text)]">npm run cf:deploy</code> 重新部署</li>
        </ol>
      </div>
    </div>
  );
}
