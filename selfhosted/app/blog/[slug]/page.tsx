import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import SiteAside from "@/app/components/SiteAside";
import ShareBar from "@/app/components/ShareBar";
import Comments from "@/app/components/Comments";
import AdminEditButton from "@/app/components/AdminEditButton";
import PostToc from "@/app/components/PostToc";
import {
  getBySlugFlexible,
  getNeighbors,
  listLatest,
  listRecommended,
  type PostMeta,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { renderMarkdown } from "@/lib/markdown";
import { buildToc } from "@/lib/toc";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function originOf(h: Headers): string {
  return `${h.get("x-forwarded-proto") || "https"}://${h.get("host") || "blog.aixivi.cn"}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, settings, h] = await Promise.all([
    getBySlugFlexible(slug),
    getSettings(),
    headers(),
  ]);
  if (!post) return { title: "文章不存在" };

  const origin = originOf(h);
  const url = `${origin}/blog/${encodeURIComponent(post.slug)}`;
  // 内嵌 base64 的封面不适合做分享卡，只有外链 / 本地路径才用
  const cover =
    post.cover_image && !post.cover_image.startsWith("data:")
      ? post.cover_image.startsWith("http")
        ? post.cover_image
        : `${origin}${post.cover_image}`
      : undefined;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      siteName: settings.siteName,
      publishedTime: new Date(post.created_at.replace(" ", "T") + "Z").toISOString(),
      images: cover ? [{ url: cover }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBySlugFlexible(slug);
  if (!post) notFound();

  const { prev, next } = await getNeighbors(post.slug);
  // 正文渲染 + 顺带提取 h2/h3 目录（给标题补锚点 id）
  const { html, items: toc } = buildToc(renderMarkdown(post.content));
  const origin = originOf(await headers());

  // 侧栏数据：与首页保持一致的两栏结构（左 836 正文 + 右 280 侧栏）
  const settings = await getSettings();
  let allPosts: PostMeta[] = [];
  let recPosts: PostMeta[] = [];
  try {
    allPosts = await listLatest(6);
    recPosts = await listRecommended();
  } catch {
    /* 侧栏属附加内容，失败不影响正文 */
  }
  // 站长手动推荐优先（排除当前文章），没设时回落最新文章
  const recommend = recPosts.length
    ? recPosts.filter((p) => p.slug !== slug).slice(0, 5)
    : allPosts.filter((p) => p.slug !== slug).slice(0, 5);

  // 当前文章分类的英文别名（用于分类链接 URL 与展示）
  const aliasFor = settings.categoryAliases[post.tag || "随笔"] || "";

  // 只要有目录就显示（至少1条）；有目录时大屏（xl+）左栏留出来放目录
  const showToc = toc.length >= 1;

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-4 py-6 md:px-6 md:py-8">
      <div
        className={
          showToc
            ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16 xl:grid-cols-[176px_minmax(0,1fr)_280px] xl:gap-10"
            : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16"
        }
      >
        {/* 左：文章目录（大屏吸顶） */}
        {showToc && (
          <aside className="hidden xl:block">
            <PostToc items={toc} />
          </aside>
        )}

        {/* 中：正文 */}
        <article className="min-w-0 main-col">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="text-sm text-[var(--c-text-3)] transition hover:text-[var(--brand-deep)]"
            >
              ← 返回首页
            </Link>
            <AdminEditButton href={`/admin/edit/${post.id}`} label="编辑文章" />
          </div>

          <header className="mt-6 border-b border-[var(--c-border-2)] pb-8">
            <div className="mb-3 flex items-center gap-3 text-xs text-[var(--c-text-3)]">
              <Link
                href={`/category/${encodeURIComponent(
                  settings.categoryAliases[post.tag || "随笔"] || post.tag || "随笔"
                )}`}
                title={aliasFor ? `${post.tag || "随笔"} · ${aliasFor}` : undefined}
                className="rounded-md bg-[var(--c-brand-soft)] px-2 py-0.5 font-medium text-[var(--brand-deep)] transition hover:bg-[var(--brand)] hover:text-[var(--brand-ink)]"
              >
                {post.tag || "随笔"}
                {aliasFor && (
                  <span className="ml-1 font-normal opacity-70">{aliasFor}</span>
                )}
              </Link>
              <time>{post.created_at.slice(0, 10)}</time>
            </div>
            <h1 className="text-[1.65rem] font-bold leading-[1.35] tracking-tight text-[var(--c-text)] sm:text-[2rem] sm:leading-[1.4]">
              {post.title}
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-[var(--c-text-3)]">
              {post.excerpt}
            </p>
          </header>

          <div
            className="prose-xivi mt-4 text-[15px]"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <ShareBar
            title={post.title}
            excerpt={post.excerpt}
            slug={post.slug}
            origin={origin}
          />

          <nav className="mt-8 grid gap-3 border-t border-[var(--c-border-2)] pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/blog/${prev.slug}`}
                className="rounded-xl border border-[var(--c-border-2)] p-4 transition hover:border-[var(--brand)]"
              >
                <span className="text-xs text-[var(--c-text-3)]">上一篇</span>
                <p className="mt-1 text-sm font-medium text-[var(--c-text)]">
                  {prev.title}
                </p>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/blog/${next.slug}`}
                className="rounded-xl border border-[var(--c-border-2)] p-4 text-right transition hover:border-[var(--brand)] sm:col-start-2"
              >
                <span className="text-xs text-[var(--c-text-3)]">下一篇</span>
                <p className="mt-1 text-sm font-medium text-[var(--c-text)]">
                  {next.title}
                </p>
              </Link>
            )}
          </nav>

          {/* 免注册留言评论（pageKey 挂文章 id，后台可管理） */}
          <Comments pageKey={`post:${post.id}`} />
        </article>

        {/* 右：侧栏 */}
        <SiteAside
          promos={settings.promos}
          logoText={settings.logoText}
          recommend={recommend}
        />
      </div>
    </div>
  );
}
