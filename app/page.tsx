import Link from "next/link";
import Highlights from "@/app/components/Highlights";
import type { Slide } from "@/app/components/Carousel";
import PagedPostList from "@/app/components/PagedPostList";
import SiteAside from "@/app/components/SiteAside";
import SectionTitle from "@/app/components/SectionTitle";
import {
  listPublishedPage,
  countPublished,
  listRecommended,
  listLatest,
  type PostMeta,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** 首页每页文章数（首屏只取这么多，其余页客户端按需拉取） */
const HOME_PAGE_SIZE = 30;

type Props = { searchParams: Promise<{ tag?: string; page?: string }> };

export default async function Home({ searchParams }: Props) {
  const { tag: activeTag, page: pageStr } = await searchParams;
  const page = Math.min(1000, Math.max(1, parseInt(pageStr || "1", 10) || 1));

  let initialPosts: PostMeta[] = [];
  let recPosts: PostMeta[] = [];
  let total = 0;
  let dbError = "";
  try {
    const offset = (page - 1) * HOME_PAGE_SIZE;
    const [pageRows, rec, cnt] = await Promise.all([
      listPublishedPage(HOME_PAGE_SIZE, offset, activeTag),
      listRecommended(),
      countPublished(activeTag),
    ]);
    initialPosts = pageRows;
    recPosts = rec;
    total = cnt;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  // 侧栏推荐：站长手动推荐的优先，没设时回落最新文章
  const recommend = recPosts.length
    ? recPosts
    : (await listLatest(5).catch(() => [] as PostMeta[]));

  const settings = await getSettings();
  const car = settings.carousel;

  // 轮播：自定义优先，否则取最新 N 篇文章。
  // 初始 slides 携带 cover_thumb（240×135 WebP，单张 2-3KB）：SSR 首屏直接渲染真实封面，
  // 不再出现纯色渐变占位图；客户端再由 <Highlights> 拉 /api/carousel 换成清晰原图。
  // 注意：封面原图（30KB+ base64 大图）仍不进首屏 RSC flight，避免 hydration 被超大属性破坏。
  let slides: Slide[] = [];
  if (car.mode === "custom" && car.slides.length > 0) {
    slides = car.slides
      .filter((s) => s.title.trim() || s.image.trim())
      .map((s, i) => ({
        key: `c${i}`,
        title: s.title,
        excerpt: s.excerpt,
        badge: s.badge,
        image: s.image,
        href: s.href || "/",
      }));
  } else {
    slides = initialPosts.slice(0, car.count).map((p) => ({
      key: `p${p.id}`,
      title: p.title,
      excerpt: p.excerpt,
      badge: p.tag,
      image: p.cover_image,
      href: `/blog/${p.slug}`,
    }));
  }

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-4 py-6 md:px-6 md:py-8">
      {dbError && (
        <div className="mb-8 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
          数据库读取失败：{dbError}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16 with-aside">
        {/* 左侧主内容 */}
        <div className="min-w-0 main-col">
          {/* 顶部：大图 banner + 最新动态（悬停标题联动切换） */}
          <Highlights slides={slides} interval={car.interval} />

          {/* 文章列表 */}
          <div className="mt-10">
            <SectionTitle
              action={
                activeTag ? (
                  <Link
                    href="/"
                    className="shrink-0 pb-1 text-xs text-[var(--brand-deep)] hover:underline"
                  >
                    ← 全部文章
                  </Link>
                ) : (
                  <Link
                    href="/history"
                    className="shrink-0 pb-1 text-xs text-[var(--brand-deep)] hover:underline"
                  >
                    历史文章 →
                  </Link>
                )
              }
            >
              {activeTag ? `标签：${activeTag}` : "文章列表"}
            </SectionTitle>
          </div>

          {!dbError && total === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--c-text-4)]">
              {activeTag ? "该标签下还没有文章" : "还没有发布任何文章"}
            </div>
          ) : (
            <PagedPostList
              key={activeTag ?? "all"}
              initialPosts={initialPosts}
              total={total}
              page={page}
              tag={activeTag}
            />
          )}
        </div>

        {/* 右侧栏 */}
        <SiteAside
          promos={settings.promos}
          logoText={settings.logoText}
          recommend={recommend}
        />
      </div>
    </div>
  );
}
