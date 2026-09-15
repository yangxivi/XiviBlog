"use client";

import { useCallback, useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { cnTime } from "@/lib/datetime";
import {
  REVISION_LIMIT,
  diffHint,
  relTime,
  revisionLabel,
  type RevisionMeta,
  type RevisionRow,
} from "@/lib/revisions";

type Props = {
  postId: number;
  /** 编辑器里当前的内容，用来算「与当前差多少行」 */
  current: { title: string; content: string };
  onClose: () => void;
  /** 恢复成功后把内容灌回编辑器状态（由父组件负责不落库，用户可再检查） */
  onRestore: (rev: RevisionRow) => void;
};

const BTN =
  "rounded-lg border border-[var(--c-border-3)] px-2.5 py-1 text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";

export default function RevisionPanel({
  postId,
  current,
  onClose,
  onRestore,
}: Props) {
  const [list, setList] = useState<RevisionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, RevisionRow>>({});
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/revisions`);
      const j = (await res.json().catch(() => ({}))) as {
        revisions?: RevisionMeta[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setList(j.revisions ?? []);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Esc 关闭 + 打开时锁住页面滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function expand(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (detail[id]) return;
    try {
      const res = await fetch(`/api/posts/${postId}/revisions/${id}`);
      const j = (await res.json().catch(() => ({}))) as {
        revision?: RevisionRow;
        error?: string;
      };
      if (!res.ok || !j.revision) throw new Error(j.error || `HTTP ${res.status}`);
      setDetail((d) => ({ ...d, [id]: j.revision as RevisionRow }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function snapshotNow() {
    setBusy(true);
    setFlash("");
    try {
      const res = await fetch(`/api/posts/${postId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || "手动存档" }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        skipped?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setNote("");
      setFlash(j.skipped ? j.message || "内容无变化" : "已存档当前版本");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: number) {
    const rev = detail[id];
    if (!rev) return;
    if (
      !confirm(
        `恢复到 ${cnTime(rev.created_at)} 的版本？\n\n当前内容会先自动存成一个版本，随时可以退回来。`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/revisions/${id}`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        revision?: RevisionRow;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.revision) {
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onRestore(j.revision);
      setFlash("已恢复该版本（内容已载入编辑器）");
      setDetail({});
      setOpenId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRev(id: number) {
    if (!confirm("删除这个版本？删除后不可恢复。")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/revisions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setDetail((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      if (openId === id) setOpenId(null);
      setFlash("版本已删除");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/25"
      />

      <aside className="relative flex h-full w-full max-w-[460px] flex-col border-l border-[var(--c-border-2)] bg-[var(--c-card)] shadow-2xl">
        {/* 头部 */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--c-border-2)] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--c-text)]">版本历史</h2>
            <p className="mt-0.5 text-xs text-[var(--c-text-4)]">
              每次保存自动留档，最多保留 {REVISION_LIMIT} 版
            </p>
          </div>
          <button onClick={onClose} className={BTN}>
            关闭
          </button>
        </header>

        {/* 手动存档 */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--c-border-2)] px-5 py-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void snapshotNow();
            }}
            placeholder="版本备注（可留空）"
            maxLength={40}
            className="min-w-0 flex-1 rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
          />
          <button
            onClick={() => void snapshotNow()}
            disabled={busy}
            className="shrink-0 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            存一版
          </button>
        </div>

        {(flash || err) && (
          <p
            className={`shrink-0 px-5 py-2 text-xs ${
              err ? "text-red-500" : "text-[var(--brand-deep)]"
            }`}
          >
            {err || flash}
          </p>
        )}

        {/* 列表 */}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-[var(--c-text-4)]">加载中…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[var(--c-text-4)]">
              还没有版本。保存一次文章就会自动留档。
            </p>
          ) : (
            <ul className="space-y-2.5">
              {list.map((r, idx) => {
                const isOpen = openId === r.id;
                const d = detail[r.id];
                const hint = d ? diffHint(d.content, current.content) : null;
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {idx === 0 && (
                            <span className="rounded bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand-ink)]">
                              最新
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              r.note
                                ? "bg-[var(--c-brand-soft)] text-[var(--brand-deep)]"
                                : "bg-[var(--c-fill)] text-[var(--c-text-3)]"
                            }`}
                          >
                            {revisionLabel(r)}
                          </span>
                          <span className="text-[11px] text-[var(--c-text-4)]">
                            {r.status === "published" ? "已发布" : "草稿"}
                          </span>
                        </div>
                        <p
                          className="mt-1.5 truncate text-sm text-[var(--c-text)]"
                          title={r.title}
                        >
                          {r.title || "(无标题)"}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--c-text-4)]">
                          {relTime(r.created_at)} · {cnTime(r.created_at)} ·{" "}
                          {r.words} 字
                          {hint && (hint.added || hint.removed) ? (
                            <>
                              {" · "}
                              <span className="text-emerald-600">
                                +{hint.added}
                              </span>
                              {" / "}
                              <span className="text-red-500">
                                −{hint.removed}
                              </span>{" "}
                              行
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <button
                          onClick={() => void expand(r.id)}
                          className={BTN}
                        >
                          {isOpen ? "收起" : "预览"}
                        </button>
                        <button
                          onClick={() => void restore(r.id)}
                          disabled={busy || !d}
                          title={d ? "恢复到这个版本" : "先预览再恢复"}
                          className={`${BTN} ${
                            d ? "" : "cursor-not-allowed opacity-40"
                          }`}
                        >
                          恢复
                        </button>
                        <button
                          onClick={() => void removeRev(r.id)}
                          disabled={busy}
                          className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 max-h-[46vh] overflow-auto rounded-lg border border-[var(--c-border-2)] bg-[var(--c-card)] p-3">
                        {d ? (
                          <div
                            className="prose-xivi text-[14px]"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(d.content || "*(空)*"),
                            }}
                          />
                        ) : (
                          <p className="text-xs text-[var(--c-text-4)]">
                            加载正文…
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
