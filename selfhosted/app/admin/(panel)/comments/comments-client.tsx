"use client";

/** 留言评论管理：最新 100 条，支持删除（同步移除前台展示） */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CommentRow } from "@/lib/comments";

/** page_key → 前台/后台可点链接 */
function pageLink(key: string) {
  if (key === "about") return { label: "关于页 · 留言", href: "/about#comments" };
  const id = key.replace(/^post:/, "");
  return { label: `文章 #${id}`, href: `/admin/edit/${id}` };
}

export default function CommentsClient({ rows }: { rows: CommentRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState("");

  async function del(id: number) {
    if (!confirm(`确定删除这条留言吗？（${rows.find((r) => r.id === id)?.nickname || ""}）`))
      return;
    setBusy(id);
    setMsg("");
    try {
      const r = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setMsg(j.error || `删除失败（HTTP ${r.status}）`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(0);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-8 text-center text-sm text-[var(--c-text-3)]">
        还没有任何留言
      </div>
    );
  }

  return (
    <div>
      {msg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {msg}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--c-border-2)] text-left text-xs text-[var(--c-text-3)]">
              <th className="px-4 py-2.5 font-medium">身份</th>
              <th className="px-4 py-2.5 font-medium">内容</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">位置</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">时间</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const loc = pageLink(r.page_key);
              return (
                <tr
                  key={r.id}
                  className="border-b border-[var(--c-border)] last:border-none"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--c-soft)] text-sm"
                      >
                        {r.avatar || "🙂"}
                      </span>
                      <span className="font-medium text-[var(--c-text)]">
                        {r.nickname}
                      </span>
                    </span>
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-[var(--c-text-2)]">
                    <span className="line-clamp-2 whitespace-pre-wrap break-words">
                      {r.content}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Link
                      href={loc.href}
                      className="text-[var(--brand-deep)] underline-offset-2 hover:underline"
                    >
                      {loc.label}
                    </Link>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-[var(--c-text-4)] sm:table-cell">
                    {r.created_at}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => del(r.id)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
