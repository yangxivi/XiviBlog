import type { Metadata } from "next";
import SearchLogger from "@/app/components/SearchLogger";
import SiteAside from "@/app/components/SiteAside";
import PagedPostList from "@/app/components/PagedPostList";
import { listPublished, listRecommended, type PostMeta } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "搜索",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function Search({ searchParams }: Props) {
  const { q } = await searchParams;
  const keyword = (q ?? "").trim();

  let allPosts: PostMeta[] = [];
  let recPosts: PostMeta[] = [];
  const settings = await getSettings();
  try {
    allPosts = await listPublished();
    recPosts = await listRecommended();
  } catch {
    /* ignore */
  }
  const recommend = recPosts.length ? recPosts : allPosts.slice(0, 5);

  const kw = keyword.toLowerCase();
  const results = kw
    ? allPosts.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.excerpt.toLowerCase().includes(kw) ||
          p.tag.toLowerCase().includes(kw)
      )
    : [];

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-4 py-6 md:px-6 md:py-8">
      {/* 关键词埋点：用于后台「搜索词」看板 */}
      {keyword && <SearchLogger q={keyword} results={results.length} />}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
        <div className="min-w-0 main-col">
          <h1 className="text-2xl font-bold text-[var(--c-text)]">
            搜索
            {keyword && (
              <span className="ml-2 text-base font-normal text-[var(--c-text-3)]">
                “{keyword}”
              </span>
            )}
          </h1>

          <form action="/search" className="mt-5 flex items-center gap-3">
            <input
              name="q"
              defaultValue={keyword}
              placeholder="输入关键词，搜索标题、摘要或标签"
              className="flex-1 rounded-lg border border-[var(--c-border)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
            >
              搜索
            </button>
          </form>

          {keyword && (
            <p className="mt-5 text-sm text-[var(--c-text-3)]">
              找到 {results.length} 篇相关文章
            </p>
          )}

          {!keyword ? (
            <p className="py-16 text-center text-sm text-[var(--c-text-4)]">
              输入关键词开始搜索
            </p>
          ) : results.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--c-text-4)]">
              没有找到与「{keyword}」相关的文章
            </p>
          ) : (
            <PagedPostList key={keyword} posts={results} />
          )}
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
