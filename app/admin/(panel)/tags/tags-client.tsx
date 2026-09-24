"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TagStat } from "@/lib/db";

type Props = { tags: TagStat[]; untagged: string; aliases: Record<string, string> };

export default function TagsClient({ tags, untagged, aliases }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const names = tags.map((t) => t.tag);

  const btn =
    "rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";

  const toggle = (t: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  async function call(
    action: "rename" | "merge" | "delete",
    from: string[],
    to?: string
  ) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, from, to }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; affected?: number; to?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const label =
        action === "delete"
          ? `已删除分类 ${from.length} 个，文章归入「${j.to}」`
          : action === "merge"
            ? `已合并到「${j.to}」`
            : `已重命名，影响 ${j.affected} 篇`;
      setMsg({ type: "ok", text: label });
      setSel(new Set());
      setEditing(null);
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function rename(from: string) {
    const to = draft.trim();
    if (!to) {
      setMsg({ type: "err", text: "新分类名不能为空" });
      return;
    }
    if (to === from) {
      setEditing(null);
      return;
    }
    if (names.includes(to)) {
      if (!window.confirm(`分类「${to}」已存在，是否把「${from}」合并进去？`))
        return;
      call("merge", [from], to);
      return;
    }
    call("rename", [from], to);
  }

  function merge(from: string) {
    const others = names.filter((n) => n !== from);
    const input = window.prompt(
      `把「${from}」合并到哪个分类？\n已有：${others.slice(0, 10).join(" / ")}`
    );
    if (input === null) return;
    const to = input.trim();
    if (!to) return;
    if (to === from) {
      setMsg({ type: "err", text: "目标分类不能是自己" });
      return;
    }
    call("merge", [from], to);
  }

  function mergeSelected() {
    const list = [...sel];
    if (list.length < 2) {
      setMsg({ type: "err", text: "请至少选择两个分类再合并" });
      return;
    }
    const input = window.prompt(
      `把选中的 ${list.length} 个分类合并到哪个分类？\n选中：${list.join(" / ")}`
    );
    if (input === null) return;
    const to = input.trim();
    if (!to) return;
    call("merge", list, to);
  }

  function removeOne(t: string) {
    if (
      !window.confirm(
        `删除分类「${t}」？\n属于该分类的文章不会被删除，会改为「${untagged}」。`
      )
    )
      return;
    call("delete", [t]);
  }

  /** 设置 / 清除英文别名 */
  async function editAlias(t: string) {
    const input = window.prompt(
      `设置「${t}」的英文别名（留空清除；分类页可用 /category/别名 访问）：`,
      aliases[t] || ""
    );
    if (input === null) return;
    const to = input.trim();
    if (to === (aliases[t] || "")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "alias", from: t, to }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({
        type: "ok",
        text: to ? `「${t}」英文别名已设为 ${to}` : `已清除「${t}」的英文别名`,
      });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-4 text-xs leading-6 text-[var(--c-text-2)]">
        <p className="font-medium text-[var(--c-text)]">分类怎么来的？</p>
        <p>
          分类在写文章时填入。这里的改动会<strong>批量更新所有引用该分类的文章</strong>：
          重命名 = 改名；合并 = 把多个分类的文章统一到目标分类；删除 = 文章归入「
          {untagged}」。
        </p>
      </div>

      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand)] bg-[var(--c-brand-soft)] px-3 py-2">
          <span className="text-xs font-medium text-[var(--brand-deep)]">
            已选 {sel.size} 个分类
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={mergeSelected}
            className={btn}
          >
            合并选中分类
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `删除选中的 ${sel.size} 个分类？文章会归入「${untagged}」。`
                )
              )
                call("delete", [...sel]);
            }}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40"
          >
            批量删除
          </button>
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="ml-auto text-xs text-[var(--c-text-3)] hover:text-[var(--c-text-2)]"
          >
            取消选择
          </button>
        </div>
      )}

      {msg && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            msg.type === "ok"
              ? "border-[var(--c-border-2)] bg-[var(--c-soft)] text-[var(--c-text-2)]"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}

      {tags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--c-border-3)] p-12 text-center text-sm text-[var(--c-text-3)]">
          还没有任何分类
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((t) => (
            <div
              key={t.tag}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                sel.has(t.tag)
                  ? "border-[var(--brand)] bg-[var(--c-brand-soft)]"
                  : "border-[var(--c-border-2)]"
              }`}
            >
              <input
                type="checkbox"
                checked={sel.has(t.tag)}
                onChange={() => toggle(t.tag)}
                className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                aria-label={`选择分类 ${t.tag}`}
              />
              <div className="min-w-0 flex-1">
                {editing === t.tag ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(t.tag);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-full rounded-lg border border-[var(--brand)] px-2 py-1 text-sm outline-none"
                  />
                ) : (
                  <p className="truncate font-medium text-[var(--c-text)]">
                    {t.tag}
                  </p>
                )}
                <p className="mt-0.5 truncate text-xs text-[var(--c-text-3)]">
                  {t.total} 篇 · 已发布 {t.published} 篇
                  {t.total - t.published > 0 && ` · 草稿 ${t.total - t.published} 篇`}
                  {aliases[t.tag] && (
                    <span className="ml-2 text-[var(--c-text-4)]">· {aliases[t.tag]}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editing === t.tag ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => rename(t.tag)}
                      className={btn}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className={btn}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(t.tag);
                        setDraft(t.tag);
                      }}
                      className={btn}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => editAlias(t.tag)}
                      className={btn}
                    >
                      英文别名
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => merge(t.tag)}
                      className={btn}
                    >
                      合并到
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeOne(t.tag)}
                      className="rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-3)] transition hover:border-red-200 hover:text-red-500 disabled:opacity-40"
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
