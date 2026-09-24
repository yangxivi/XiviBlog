"use client";

import { useEffect, useRef, useState } from "react";
import PostListItem from "./PostListItem";
import type { PostMeta } from "@/lib/db";

const PAGE = 20;

/**
 * 首页文章列表：首屏服务端渲染前 20 篇（利于 SEO），
 * 之后用 IntersectionObserver 监听底部哨兵，滚到第 20 篇时自动再加载 20 篇，
 * 直到全部加载完。同时保留一个「加载更多」按钮作为兜底。
 *
 * 整份文章元数据已由首页服务端一次性取出（纯元数据、不含正文，很轻），
 * 这里只做客户端分片渲染，不额外发请求。
 */
export default function InfinitePostList({ posts }: { posts: PostMeta[] }) {
  const [count, setCount] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 监听底部哨兵：进入视口（含 400px 预加载区）就翻一页
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => Math.min(c + PAGE, posts.length));
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [posts.length]);

  const visible = posts.slice(0, count);
  const hasMore = count < posts.length;

  return (
    <div>
      {visible.map((p) => (
        <PostListItem key={p.id} post={p} />
      ))}

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-8"
        >
          <button
            type="button"
            onClick={() =>
              setCount((c) => Math.min(c + PAGE, posts.length))
            }
            className="rounded-lg border border-[var(--c-border-3)] px-5 py-2 text-sm text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
          >
            下拉加载更多…
          </button>
        </div>
      ) : posts.length > PAGE ? (
        <div className="py-8 text-center text-xs text-[var(--c-text-4)]">
          已经到底啦 ～
        </div>
      ) : null}
    </div>
  );
}
