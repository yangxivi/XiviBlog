import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PagedPostList from "@/app/components/PagedPostList";
import SiteAside from "@/app/components/SiteAside";
import SectionTitle from "@/app/components/SectionTitle";
import {
  listByCategory,
  listLatest,
  listRecommended,
  listTags,
  type PostMeta,
  type TagCount,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const raw = decodeURIComponent(rawSlug);
  const settings = await getSettings();
  // 支持用英文别名访问，标题统一显示中文名
  const zh = Object.entries(settings.categoryAliases).find(
    ([, en]) => en.toLowerCase() === raw.toLowerCase()
  )?.[0];
  const name = zh || raw;
  return {
    title: `分类：${name}`,
    description: `「${name}」分类下的文章`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const raw = decodeURIComponent(rawSlug);
  const settings = await getSettings();

  // 英文别名 → 中文分类名（大小写不敏感）
  const aliasHit = Object.entries(settings.categoryAliases).find(
    ([, en]) => en.toLowerCase() === raw.toLowerCase()
  );
  const slug = aliasHit?.[0] ?? raw;
  const alias = aliasHit?.[1] ?? settings.categoryAliases[slug] ?? "";

  let posts: PostMeta[] = [];
  let allPosts: PostMeta[] = [];
  let recPosts: PostMeta[] = [];
  let tags: TagCount[] = [];
  let dbError = "";

  try {
    [posts, allPosts, recPosts, tags] = await Promise.all([
      listByCategory(slug),
      listLatest(5),
      listRecommended(),
      listTags(),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const recommend = recPosts.length ? recPosts : allPosts.slice(0, 5);

  const hasCategory = tags.some((t) => t.tag === slug);

  if (!dbError && posts.length === 0 && !hasCategory) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-4 py-6 md:px-6 md:py-8">
      {dbError && (
        <div className="mb-8 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
          数据库读取失败：{dbError}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
        <div className="min-w-0 main-col">
          <SectionTitle
            action={
              <Link
                href="/"
                className="shrink-0 pb-1 text-xs text-[var(--brand-deep)] hover:underline"
              >
                ← 全部文章
              </Link>
            }
          >
            分类：{slug}
            {alias && (
              <span className="ml-2 text-xs font-normal text-[var(--c-text-4)]">
                {alias}
              </span>
            )}
          </SectionTitle>

          {!dbError && posts.length === 0 && hasCategory && (
            <div className="py-16 text-center text-sm text-[var(--c-text-4)]">
              该分类下还没有文章
            </div>
          )}

          <PagedPostList key={slug} posts={posts} />
        </div>

        <SiteAside
          promos={settings.promos}
          logoText={settings.logoText}
          recommend={recommend}
        />
      </div>
    </div>
  );
}
