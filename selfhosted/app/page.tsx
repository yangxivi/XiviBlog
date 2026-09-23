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
import { coverUrl } from "@/lib/cover-url";

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
  // 文章模式的 image 指向 /api/posts/cover 直出的**原图 URL**（不是 base64）：
  // URL 只有几十字节，<img> 直接出现在 SSR 首屏 HTML 里，浏览器解析到就开始下载
  // 高清封面，不会再出现「先虚 2-3 秒、再被客户端换成清晰图」。
  // 列表小图仍然 base64 内联（240×135 WebP、2-3KB，零请求随首屏出现最划算）。
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
      image: p.cover_image ? coverUrl(p.id, p.cover_image, p.updated_at) : "",
      href: `/blog/${p.slug}`,
    }));
  }

  // 首张轮播图预加载：它是首屏最大的一块内容，提前发起下载能跟 JS 解析并行。
  // 自定义轮播可能填的是 base64（data:），那种情况绝不能塞进 href——会把大图
  // 字符串重复进 DOM，白白撑大首屏。
  const firstImage =
    slides[0]?.image && !slides[0].image.startsWith("data:")
      ? slides[0].image
      : "";

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-4 py-6 md:px-6 md:py-8">
      {firstImage && (
        <link rel="preload" as="image" href={firstImage} fetchPriority="high" />
      )}
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
