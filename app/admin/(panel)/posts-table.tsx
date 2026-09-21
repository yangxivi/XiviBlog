"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/db";
import { isScheduled } from "@/lib/datetime";
import CoverThumb from "@/app/components/CoverThumb";
import { useConfirm } from "./use-confirm";
import { generateAiCover, makeListThumb } from "./image-utils";

const PAGE_SIZE = 15;

const statusStyle: Record<string, string> = {
  published: "bg-[var(--c-brand-soft)] text-[var(--brand-deep)]",
  draft: "bg-[var(--c-fill)] text-[var(--c-text-3)]",
};

type Props = { posts: PostMeta[]; tags: string[] };

/** 侧边栏「推荐阅读」名额，与 lib/db.ts 的 RECOMMEND_LIMIT 保持一致 */
const RECOMMEND_LIMIT = 10;

export default function PostsTable({ posts, tags }: Props) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [tag, setTag] = useState("all");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (tag !== "all" && p.tag !== tag) return false;
      if (!kw) return true;
      return (
        p.title.toLowerCase().includes(kw) ||
        p.slug.toLowerCase().includes(kw) ||
        p.tag.toLowerCase().includes(kw) ||
        p.excerpt.toLowerCase().includes(kw)
      );
    });
  }, [posts, q, status, tag]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const pageItems = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const allChecked =
    pageItems.length > 0 && pageItems.every((p) => sel.has(p.id));

  // 页码窗口：最多显示 5 个（以当前页为中心）；总页数 > 5 时再用输入框跳页（同前台）
  const pager = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.min(Math.max(cur - 2, 1), totalPages - 4);
    return [start, start + 1, start + 2, start + 3, start + 4];
  }, [cur, totalPages]);

  /** 当前推荐占用名额 */
  const recCount = useMemo(
    () => posts.filter((p) => p.recommended).length,
    [posts]
  );

  const reset = () => setPage(1);

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSel((s) => {
      const n = new Set(s);
      if (allChecked) pageItems.forEach((p) => n.delete(p.id));
      else pageItems.forEach((p) => n.add(p.id));
      return n;
    });

  /** 清掉已不存在的选中项 */
  const cleanSel = () => {
    const live = new Set(posts.map((p) => p.id));
    setSel((s) => new Set([...s].filter((id) => live.has(id))));
  };

  async function bulk(
    action:
      | "publish"
      | "draft"
      | "delete"
      | "tag"
      | "pin"
      | "unpin"
      | "recommend"
      | "unrecommend"
  ) {
    const ids = [...sel];
    if (ids.length === 0) return;

    let extra: { tag?: string } = {};
    if (action === "tag") {
      const input = window.prompt("把这些文章改为哪个标签？（文章管理里已有：" + tags.slice(0, 6).join(" / ") + "）");
      if (input === null) return;
      if (!input.trim()) {
        setMsg({ type: "err", text: "标签不能为空" });
        return;
      }
      extra = { tag: input.trim() };
    }
    if (action === "delete") {
      if (!window.confirm(`确定删除选中的 ${ids.length} 篇文章？此操作不可撤销。`))
        return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, ...extra }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; affected?: number };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const label =
        action === "publish"
          ? "已发布"
          : action === "draft"
            ? "已转为草稿"
            : action === "delete"
              ? "已删除"
              : action === "pin"
                ? "已置顶"
                : action === "unpin"
                  ? "已取消置顶"
                  : action === "recommend"
                    ? "已设为推荐"
                    : action === "unrecommend"
                      ? "已取消推荐"
                      : "已改标签";
      setMsg({ type: "ok", text: `${label} ${j.affected ?? ids.length} 篇` });
      setSel(new Set());
      cleanSel();
      router.refresh();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  /** 批量 AI 封面：逐篇按文章内容生成契合主题的封面（与编辑器「AI 换一张」同一链路），
   *  浏览器直连 agnes 生图 → 635×360 中心裁切 → 写回 cover_image（cover_thumb 留空回落原图） */
  async function genThumbs() {
    const ids = [...sel];
    if (ids.length === 0) return;
    const ok = await ask({
      title: "批量 AI 生成封面",
      message: `将按文章内容为选中的 ${ids.length} 篇文章逐篇生成 AI 封面（635×360，与编辑器「AI 换一张」同款），会覆盖现有封面。每篇约 5-20 秒，${ids.length} 篇预计 ${Math.max(1, Math.round((ids.length * 12) / 60))} 分钟左右，期间请勿关闭页面。继续？`,
      okText: "开始生成",
    });
    if (!ok) return;

    setBusy(true);
    setMsg({ type: "ok", text: `正在生成 AI 封面 0/${ids.length}…` });
    let done = 0;
    let failed = 0;
    const fails: string[] = [];
    try {
      for (const id of ids) {
        setMsg({
          type: "ok",
          text: `正在生成 AI 封面 ${done + failed + 1}/${ids.length}…（每篇约 5-20 秒）`,
        });
        // 拉完整文章拿标题/正文/分类，供提示词构造
        const res = await fetch(`/api/posts?id=${id}`);
        const j = (await res.json().catch(() => ({}))) as {
          post?: {
            title?: string;
            excerpt?: string;
            content?: string;
            tag?: string;
            tags?: string;
          };
          error?: string;
        };
        if (!res.ok || !j.post) throw new Error(j.error || `HTTP ${res.status}`);
        const p = j.post;
        if (!p.title?.trim() && !p.content?.trim()) {
          failed++;
          fails.push(`#${id}（无标题无正文）`);
          continue;
        }
        try {
          const dataUrl = await generateAiCover({
            title: p.title || "",
            excerpt: p.excerpt,
            content: p.content,
            category: p.tag,
            tags: p.tags,
          });
          const save = await fetch("/api/posts/thumb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              cover_image: dataUrl,
              cover_thumb: await makeListThumb(dataUrl),
            }),
          });
          const sj = (await save.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
          };
          if (!save.ok || !sj.ok)
            throw new Error(sj.error || `HTTP ${save.status}`);
          done++;
        } catch (e) {
          // 单篇失败不中断整批，最后汇总
          failed++;
          fails.push(`「${(p.title || `#${id}`).slice(0, 20)}」：${e instanceof Error ? e.message : String(e)}`);
        }
        // 篇间稍作间隔，降低上游限流概率
        await new Promise((r) => setTimeout(r, 1200));
      }
      setMsg({
        type: failed
          ? "err"
          : "ok",
        text: `AI 封面生成完成：成功 ${done} 篇${failed ? `，失败 ${failed} 篇（${fails.slice(0, 3).join("；")}${fails.length > 3 ? "…" : ""}）` : ""}`,
      });
      router.refresh();
    } catch (e) {
      setMsg({
        type: "err",
        text: `生成中断（已完成 ${done} 篇）：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setBusy(false);
    }
  }

  /** 单篇快捷操作（与批量共用同一个接口，不影响当前勾选） */
  async function oneShot(id: number, action: "pin" | "unpin" | "recommend" | "unrecommend") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], action }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({
        type: "ok",
        text:
          action === "pin"
            ? "已置顶"
            : action === "unpin"
              ? "已取消置顶"
              : action === "recommend"
                ? "已加入推荐"
                : "已取消推荐",
      });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(id: number, title: string) {
    const ok = await ask({
      title: "删除文章",
      message: `确定删除《${title}》？此操作不可撤销。`,
      danger: true,
      okText: "删除",
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; affected?: number };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({ type: "ok", text: "已删除" });
      cleanSel();
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";

  return (
    <div>
      {/* 筛选栏 */}
      <div className="mb-4 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              reset();
            }}
            placeholder="搜索标题 / slug / 标签 / 摘要…"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--brand)]"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              reset();
            }}
            className="rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--brand)]"
          >
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </select>
          <select
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              reset();
            }}
            className="rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--brand)]"
          >
            <option value="all">全部标签</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {(q || status !== "all" || tag !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("all");
                setTag("all");
                reset();
              }}
              className={btn}
            >
              清空筛选
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--c-text-3)]">
          共 {posts.length} 篇，筛选出 <span className="font-medium text-[var(--brand-deep)]">{filtered.length}</span> 篇
          {sel.size > 0 && ` · 已选 ${sel.size} 篇`}
          <span className="ml-2">
            · 推荐名额{" "}
            <span
              className={`font-medium ${
                recCount >= RECOMMEND_LIMIT ? "text-[#FF6B35]" : "text-[var(--brand-deep)]"
              }`}
            >
              {recCount}/{RECOMMEND_LIMIT}
            </span>
          </span>
        </p>
      </div>

      {/* 批量操作栏 */}
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand)] bg-[var(--c-brand-soft)] px-3 py-2">
          <span className="text-xs font-medium text-[var(--brand-deep)]">
            已选 {sel.size} 篇
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("publish")}
            className={btn}
          >
            批量发布
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("draft")}
            className={btn}
          >
            转为草稿
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("pin")}
            className={btn}
          >
            置顶
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("unpin")}
            className={btn}
          >
            取消置顶
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("recommend")}
            className={btn}
          >
            设为推荐
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("unrecommend")}
            className={btn}
          >
            取消推荐
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("tag")}
            className={btn}
          >
            改标签
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={genThumbs}
            title="按文章内容逐篇生成契合主题的 AI 封面（635×360），会覆盖现有封面"
            className={btn}
          >
            AI 生成封面
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulk("delete")}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40"
          >
            删除
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

      {/* 分页（列表上下各一份） */}
      {totalPages > 1 && (
        <div className="mb-3 mt-1 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={cur <= 1}
            onClick={() => setPage(cur - 1)}
            className={btn}
          >
            上一页
          </button>
          <div className="flex items-center gap-1">
            {pager.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`h-7 min-w-[1.75rem] rounded-lg px-1.5 text-xs transition ${
                  cur === n
                    ? "bg-[var(--brand)] font-medium text-[var(--brand-ink)]"
                    : "text-[var(--c-text-3)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text-2)]"
                }`}
              >
                {n}
              </button>
            ))}
            {totalPages > 5 && (
              <PageJump totalPages={totalPages} onJump={setPage} />
            )}
            <span className="ml-1 whitespace-nowrap text-xs text-[var(--c-text-3)]">
              共 {totalPages} 页
            </span>
          </div>
          <button
            type="button"
            disabled={cur >= totalPages}
            onClick={() => setPage(cur + 1)}
            className={btn}
          >
            下一页
          </button>
        </div>
      )}

      {/* 表头 */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--c-soft)] rounded-t-xl">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="h-4 w-4 accent-[var(--brand)]"
            aria-label="全选本页"
          />
          <span className="text-xs text-[var(--c-text-3)] font-medium">
            全选本页（{pageItems.length} 篇）
          </span>
        </div>
      )}

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--c-border-3)] p-12 text-center text-sm text-[var(--c-text-3)]">
          {posts.length === 0 ? "还没有文章，点右上角「新文章」写第一篇" : "没有匹配的文章"}
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                sel.has(p.id)
                  ? "border-[var(--brand)] bg-[var(--c-brand-soft)]"
                  : "border-[var(--c-border-2)] hover:border-[var(--brand)]"
              }`}
            >
              <input
                type="checkbox"
                checked={sel.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                aria-label={`选择 ${p.title}`}
              />
              {p.cover_image ? (
                <CoverThumb
                  src={p.cover_image}
                  className="h-12 w-16 shrink-0 rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                />
              ) : (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--c-fill)] text-[10px] text-[var(--c-text-3)]">
                  无图
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusStyle[p.status] || ""}`}
                  >
                    {isScheduled(p) ? "定时中" : p.status === "published" ? "已发布" : "草稿"}
                  </span>
                  {p.pinned ? (
                    <span className="rounded bg-[var(--brand)] px-1.5 py-0.5 text-xs font-semibold text-[var(--brand-ink)]">
                      置顶
                    </span>
                  ) : null}
                  <span className="rounded bg-[var(--c-soft)] px-1.5 py-0.5 text-xs text-[var(--c-text-3)]">
                    {p.tag}
                  </span>
                </div>
                <p className="mt-1.5 truncate font-medium text-[var(--c-text)]">
                  {p.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--c-text-3)]">
                  /{p.slug} · {p.created_at.slice(0, 10)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  title={p.pinned ? "取消置顶" : "置顶"}
                  onClick={() => oneShot(p.id, p.pinned ? "unpin" : "pin")}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    p.pinned
                      ? "border-[var(--brand)] bg-[var(--c-brand-soft)] text-[var(--brand-deep)]"
                      : "border-[var(--c-border-3)] text-[var(--c-text-3)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
                  }`}
                >
                  {p.pinned ? "已置顶" : "置顶"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title={
                    p.recommended
                      ? "取消推荐（侧边栏「推荐阅读」）"
                      : "设为推荐（侧边栏「推荐阅读」，共 5 个名额）"
                  }
                  onClick={() =>
                    oneShot(p.id, p.recommended ? "unrecommend" : "recommend")
                  }
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    p.recommended
                      ? "border-[#FF6B35] bg-orange-50 text-[#FF6B35]"
                      : "border-[var(--c-border-3)] text-[var(--c-text-3)] hover:border-[#FF6B35] hover:text-[#FF6B35]"
                  }`}
                >
                  {p.recommended ? "已推荐" : "推荐"}
                </button>
                <Link href={`/admin/edit/${p.id}`} className={btn}>
                  编辑
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeOne(p.id, p.title)}
                  className="rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-3)] transition hover:border-red-200 hover:text-red-500 disabled:opacity-40"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页（底部） */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={cur <= 1}
            onClick={() => setPage(cur - 1)}
            className={btn}
          >
            上一页
          </button>
          <div className="flex items-center gap-1">
            {pager.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`h-7 min-w-[1.75rem] rounded-lg px-1.5 text-xs transition ${
                  cur === n
                    ? "bg-[var(--brand)] font-medium text-[var(--brand-ink)]"
                    : "text-[var(--c-text-3)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text-2)]"
                }`}
              >
                {n}
              </button>
            ))}
            {totalPages > 5 && (
              <PageJump totalPages={totalPages} onJump={setPage} />
            )}
            <span className="ml-1 whitespace-nowrap text-xs text-[var(--c-text-3)]">
              共 {totalPages} 页
            </span>
          </div>
          <button
            type="button"
            disabled={cur >= totalPages}
            onClick={() => setPage(cur + 1)}
            className={btn}
          >
            下一页
          </button>
        </div>
      )}
      {dialog}
    </div>
  );
}

/** 跳页输入框（同前台）：输入数字回车/失焦即跳转，超出范围自动忽略 */
function PageJump({
  totalPages,
  onJump,
}: {
  totalPages: number;
  onJump: (n: number) => void;
}) {
  const [v, setV] = useState("");

  const go = () => {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      onJump(n);
    }
    setV("");
  };

  return (
    <span className="flex items-center gap-1 text-xs">
      <input
        type="number"
        min={1}
        max={totalPages}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        }}
        onBlur={go}
        placeholder="跳"
        aria-label="跳转到指定页"
        className="h-7 w-12 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-1 text-center text-xs text-[var(--c-text)] outline-none transition focus:border-[var(--brand)]"
      />
      <span className="text-[var(--c-text-4)]">页</span>
    </span>
  );
}
