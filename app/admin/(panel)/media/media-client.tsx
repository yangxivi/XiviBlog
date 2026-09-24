"use client";

import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@/app/api/media/route";
import CoverThumb from "@/app/components/CoverThumb";

type Resp = { items: MediaItem[]; totalPosts: number; inlineBytes: number };

const KIND_LABEL: Record<MediaItem["kind"], string> = {
  inline: "内嵌图片",
  external: "外链图片",
  local: "站内文件",
};

const kindStyle: Record<MediaItem["kind"], string> = {
  inline: "bg-[var(--c-brand-soft)] text-[var(--brand-deep)]",
  external: "bg-[var(--c-fill)] text-[var(--c-text-2)]",
  local: "bg-[var(--c-soft)] text-[var(--c-text-3)]",
};

function fmtSize(chars: number) {
  const bytes = Math.round(chars * 0.75); // base64 → 约 3/4 体积
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function MediaClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | MediaItem["kind"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  async function load() {
    try {
      const res = await fetch("/api/media");
      const j = (await res.json().catch(() => ({}))) as Resp & { ok?: boolean; error?: string; affected?: number };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const kw = q.trim().toLowerCase();
    return list.filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (!kw) return true;
      return (
        it.url.toLowerCase().includes(kw) ||
        it.posts.some((p) => p.title.toLowerCase().includes(kw))
      );
    });
  }, [data, q, filter]);

  async function detach(it: MediaItem) {
    if (
      !window.confirm(
        `解除引用？\n用到这张图的 ${it.count} 篇文章封面会被清空（可用渐变占位）。\n图片本身若为外链不会被删除。`
      )
    )
      return;
    setBusy(it.url);
    setMsg(null);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detach", url: it.url }),
      });
      const j = (await res.json().catch(() => ({}))) as Resp & { ok?: boolean; error?: string; affected?: number };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({ type: "ok", text: `已解除 ${j.affected} 篇的封面引用` });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy("");
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMsg({ type: "ok", text: "图片地址已复制" });
    } catch {
      setMsg({ type: "err", text: "复制失败，请手动选择地址" });
    }
  }

  const btn =
    "rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";

  if (err) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        加载失败：{err}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--c-border-3)] p-12 text-center text-sm text-[var(--c-text-3)]">
        加载中…
      </div>
    );
  }

  const counts = {
    all: data.items.length,
    inline: data.items.filter((i) => i.kind === "inline").length,
    external: data.items.filter((i) => i.kind === "external").length,
    local: data.items.filter((i) => i.kind === "local").length,
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "图片总数", v: String(data.items.length) },
          { k: "被引用文章", v: String(data.totalPosts) },
          { k: "内嵌图片", v: String(counts.inline) },
          { k: "内嵌占用", v: fmtSize(data.inlineBytes) },
        ].map((c) => (
          <div
            key={c.k}
            className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] px-3 py-2"
          >
            <p className="text-lg font-bold text-[var(--c-text)]">{c.v}</p>
            <p className="text-xs text-[var(--c-text-3)]">{c.k}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按图片地址或文章标题搜索…"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--brand)]"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--brand)]"
        >
          <option value="all">全部类型（{counts.all}）</option>
          <option value="inline">内嵌图片（{counts.inline}）</option>
          <option value="external">外链图片（{counts.external}）</option>
          <option value="local">站内文件（{counts.local}）</option>
        </select>
      </div>

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

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--c-border-3)] p-12 text-center text-sm text-[var(--c-text-3)]">
          没有匹配的图片
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.url.slice(0, 64) + it.url.length}
              className="overflow-hidden rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)]"
            >
              <div className="relative aspect-video bg-[var(--c-fill)]">
                <CoverThumb
                  src={it.url}
                  className="h-full w-full"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span
                  className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${kindStyle[it.kind]}`}
                >
                  {KIND_LABEL[it.kind]}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-xs text-[var(--c-text-3)]">
                  {it.kind === "inline"
                    ? `内嵌图片 · ${fmtSize(it.url.length)}`
                    : it.url}
                </p>
                <p className="mt-1 text-xs text-[var(--c-text-2)]">
                  被 {it.count} 篇文章引用
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {it.kind !== "inline" && (
                    <button
                      type="button"
                      onClick={() => copy(it.url)}
                      className={btn}
                    >
                      复制地址
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(open === it.url ? null : it.url)}
                    className={btn}
                  >
                    {open === it.url ? "收起" : "查看引用"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === it.url}
                    onClick={() => detach(it)}
                    className="rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-3)] transition hover:border-red-200 hover:text-red-500 disabled:opacity-40"
                  >
                    解除引用
                  </button>
                </div>
                {open === it.url && (
                  <ul className="mt-2 space-y-1 border-t border-[var(--c-border-2)] pt-2">
                    {it.posts.slice(0, 12).map((p) => (
                      <li key={p.id}>
                        <a
                          href={`/admin/edit/${p.id}`}
                          className="line-clamp-1 text-xs text-[var(--c-text-2)] hover:text-[var(--brand-deep)]"
                        >
                          · {p.title}
                        </a>
                      </li>
                    ))}
                    {it.posts.length > 12 && (
                      <li className="text-xs text-[var(--c-text-3)]">
                        等 {it.posts.length} 篇
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
