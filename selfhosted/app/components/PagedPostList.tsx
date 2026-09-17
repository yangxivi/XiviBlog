"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PostListItem from "./PostListItem";
import { scrollMainToTop } from "./scrollContainer";
import type { PostMeta } from "@/lib/db";

const PAGE_SIZE = 30;

type Props = {
  /** 客户端模式：直接给定完整列表（分类/搜索页已本地过滤好），纯前端分页，不请求接口 */
  posts?: PostMeta[];
  /** 服务端模式（首页/历史页）：首屏只取一页，翻页按需拉 /api/posts，避免把全部文章塞进首屏 */
  initialPosts?: PostMeta[];
  total?: number;
  page?: number;
  tag?: string;
  /** 服务端模式下的年份过滤（历史归档页） */
  year?: string;
};

export default function PagedPostList({
  posts,
  initialPosts,
  total = 0,
  page: initialPage = 1,
  tag,
  year,
}: Props) {
  const clientMode = Array.isArray(posts);

  const [page, setPage] = useState(clientMode ? 1 : initialPage);
  const [serverPosts, setServerPosts] = useState<PostMeta[]>(initialPosts ?? []);
  const [loading, setLoading] = useState(false);
  // 已拉取过的页缓存，翻页不重复请求，回翻瞬时
  const cache = useRef<Map<number, PostMeta[]>>(new Map());
  if (!clientMode && initialPosts && !cache.current.has(initialPage)) {
    cache.current.set(initialPage, initialPosts);
  }

  const totalPages = useMemo(() => {
    if (clientMode) return Math.max(1, Math.ceil((posts?.length ?? 0) / PAGE_SIZE));
    return Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  }, [clientMode, posts, total]);

  const visible = useMemo(() => {
    if (clientMode) return (posts ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return serverPosts;
  }, [clientMode, posts, page, serverPosts]);

  const isEmpty = clientMode
    ? (posts?.length ?? 0) === 0
    : (total ?? 0) === 0;

  const goTo = useCallback(
    async (target: number) => {
      const t = Math.min(Math.max(1, target), totalPages);
      setPage(t);
      scrollMainToTop();
      if (clientMode) return; // 数据已在本地，直接切页
      // 服务端模式：命中缓存直接渲染，否则拉取对应页
      const hit = cache.current.get(t);
      if (hit) {
        setServerPosts(hit);
        return;
      }
      setLoading(true);
      try {
        const u = new URL("/api/posts", window.location.origin);
        u.searchParams.set("page", String(t));
        u.searchParams.set("size", String(PAGE_SIZE));
        if (tag) u.searchParams.set("tag", tag);
        if (year) u.searchParams.set("year", year);
        const d = (await fetch(u.toString()).then((r) => r.json())) as {
          posts?: PostMeta[];
        };
        const rows: PostMeta[] = Array.isArray(d.posts) ? d.posts : [];
        cache.current.set(t, rows);
        setServerPosts(rows);
      } catch {
        /* 拉取失败保持上一页内容，不阻断浏览 */
      } finally {
        setLoading(false);
      }
    },
    [clientMode, totalPages, tag, year]
  );

  // 页码窗口：最多显示 3 个（以当前页为中心）；总页数 > 3 时再用输入框跳页
  const pager = useMemo(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.min(Math.max(page - 1, 1), totalPages - 2);
    return [start, start + 1, start + 2];
  }, [page, totalPages]);

  if (isEmpty) {
    return (
      <div className="py-16 text-center text-sm text-[var(--c-text-4)]">
        暂无文章
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {visible.map((p) => (
          <PostListItem key={p.id} post={p} />
        ))}
        {loading && (
          <div className="py-6 text-center text-xs text-[var(--c-text-4)]">
            加载中…
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex flex-nowrap items-center justify-center gap-1 border-t border-[var(--c-border-2)] pt-6 sm:justify-between sm:gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
            className="rounded-lg border border-[var(--c-border-3)] px-2.5 py-2 text-sm text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
            aria-label="上一页"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← 上一页</span>
          </button>

          <div className="flex items-center gap-1 text-sm text-[var(--c-text-3)] sm:gap-1.5">
            {pager.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => goTo(target)}
                className={`h-7 min-w-[1.75rem] rounded-lg px-1.5 text-xs transition sm:h-8 sm:min-w-[2rem] sm:px-2 ${
                  page === target
                    ? "bg-[var(--brand)] font-medium text-[var(--brand-ink)]"
                    : "text-[var(--c-text-3)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text-2)]"
                }`}
              >
                {target}
              </button>
            ))}

            {totalPages > 3 && (
              <JumpInput totalPages={totalPages} onJump={(n) => goTo(n)} />
            )}

            <span className="ml-1 whitespace-nowrap text-xs">共 {totalPages} 页</span>
          </div>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goTo(page + 1)}
            className="rounded-lg border border-[var(--c-border-3)] px-2.5 py-2 text-sm text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
            aria-label="下一页"
          >
            <span className="sm:hidden">→</span>
            <span className="hidden sm:inline">下一页 →</span>
          </button>
        </nav>
      )}
    </div>
  );
}

/** 跳页输入框：输入数字回车/失焦即跳转，超出范围自动忽略 */
function JumpInput({
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
        className="h-7 w-11 rounded-lg border border-[var(--c-border-3)] px-1 text-center text-xs outline-none transition focus:border-[var(--brand)] sm:h-8 sm:w-14 sm:px-2"
      />
      <span className="text-[var(--c-text-4)]">页</span>
    </span>
  );
}
