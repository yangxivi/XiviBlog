"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";

/** 客户端用的 slug 规范化（与服务端 slugify 一致，但不引入服务端依赖） */
function clientSlugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type PageEditorInitial = {
  id?: number;
  title: string;
  slug: string;
  content: string;
  show_in_nav: number;
  nav_order: number;
  allow_comments: number;
};

const FIELD =
  "min-w-0 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--brand)]";
const INPUT = `w-full ${FIELD}`;
const LABEL = "mb-1 block text-xs font-medium text-[var(--c-text-3)]";
const BTN_GHOST =
  "rounded-lg border border-[var(--c-border-3)] px-2.5 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]";

export default function PageEditor({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial?: PageEditorInitial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [showInNav, setShowInNav] = useState(initial?.show_in_nav === 1);
  const [navOrder, setNavOrder] = useState(initial?.nav_order ?? 0);
  const [allowComments, setAllowComments] = useState(initial?.allow_comments === 1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const previewSlug = slug.trim() ? clientSlugify(slug) : clientSlugify(title);
  const html = useMemo(() => renderMarkdown(content), [content]);

  async function save() {
    if (!title.trim()) {
      setMsg("标题不能为空");
      return;
    }
    setSaving(true);
    setMsg("");
    const body = {
      title: title.trim(),
      slug: slug.trim(),
      content,
      show_in_nav: showInNav ? 1 : 0,
      nav_order: Number(navOrder) || 0,
      allow_comments: allowComments ? 1 : 0,
    };
    try {
      const res = await fetch(
        mode === "new" ? "/api/pages" : `/api/pages/${initial?.id}`,
        {
          method: mode === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: number; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg(mode === "new" ? "已创建" : "已保存");
      if (mode === "new" && j.id) {
        router.replace(`/admin/pages/edit/${j.id}`);
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial?.id) return;
    if (!confirm("确定删除这个页面？不可恢复。")) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pages/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      router.push("/admin/pages");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "删除失败");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--c-text-3)]">
          <button
            onClick={() => router.push("/admin/pages")}
            className="transition hover:text-[var(--brand-deep)]"
          >
            ← 返回列表
          </button>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && initial?.id && (
            <button
              onClick={remove}
              disabled={saving}
              className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            >
              删除
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {saving ? "保存中…" : mode === "new" ? "创建页面" : "保存"}
          </button>
        </div>
      </div>

      {msg && (
        <p className="rounded-lg bg-[var(--c-brand-soft)] px-4 py-2 text-sm text-[var(--brand-deep)]">
          {msg}
        </p>
      )}

      {/* 标题 + slug */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>页面标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="如：留言板"
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>URL 路径（留空按标题生成）</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="如：guestbook"
            className={INPUT}
          />
          <p className="mt-1 text-xs text-[var(--c-text-4)]">
            访问地址：/{previewSlug || "（由标题生成）"}
          </p>
        </div>
      </div>

      {/* 选项 */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-4 py-3">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-[var(--c-text-2)]">
          <input
            type="checkbox"
            checked={showInNav}
            onChange={(e) => setShowInNav(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          显示在顶部导航
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--c-text-2)]">导航排序</span>
          <input
            type="number"
            value={navOrder}
            onChange={(e) => setNavOrder(Number(e.target.value))}
            className="w-20 rounded-lg border border-[var(--c-border-3)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
          />
          <span className="text-xs text-[var(--c-text-4)]">越小越靠前</span>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-[var(--c-text-2)]">
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          允许留言评论
        </label>
      </div>

      {/* 正文：左编辑 + 右预览 */}
      <div>
        <label className={LABEL}>正文（支持 Markdown）</label>
        <div className="mt-1 grid gap-4 lg:grid-cols-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"## 小标题\n\n在这里写页面内容，支持 **粗体**、列表、`代码`、[链接](https://) 等 Markdown 语法。"}
            spellCheck={false}
            className="min-h-[420px] resize-y rounded-xl border border-[var(--c-border-3)] bg-[var(--c-card)] p-4 font-mono text-sm leading-7 outline-none transition focus:border-[var(--brand)]"
          />
          <div className="min-h-[420px] overflow-auto rounded-xl border border-[var(--c-border-2)] bg-[var(--c-page)] p-4">
            <p className="mb-2 text-xs text-[var(--c-text-4)]">实时预览</p>
            <div
              className="prose-xivi text-[15px]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
