import Link from "next/link";
import type { Metadata } from "next";
import SiteAside from "@/app/components/SiteAside";
import PagedPostList from "@/app/components/PagedPostList";
import {
  listYearCounts,
  listPublishedPage,
  countPublished,
  listRecommended,
  listLatest,
  type PostMeta,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "历史文章",
  description: "曦微 XIVI 的全部文章归档。",
};

/** 归档页每页文章数（首屏只取这一页，其余页客户端按需拉 /api/posts） */
const PAGE_SIZE = 30;

type Props = { searchParams: Promise<{ year?: string; page?: string }> };

function chip(active: boolean): string {
  return `rounded-md px-4 py-1.5 text-sm transition ${
    active
      ? "bg-[var(--brand)] font-medium text-[var(--brand-ink)]"
      : "text-[var(--c-text-2)] hover:bg-[var(--c-fill)]"
  }`;
}

export default async function History({ searchParams }: Props) {
  const { year, page: pageStr } = await searchParams;
  const page = Math.min(1000, Math.max(1, parseInt(pageStr || "1", 10) || 1));
  // 年份先做格式校验，非法值直接当「全部」，避免拼接出无效查询
  const wantedYear = /^\d{4}$/.test(year || "") ? (year as string) : "";

  let yearCounts: { y: string; n: number }[] = [];
  let rows: PostMeta[] = [];
  let total = 0;
  let recPosts: PostMeta[] = [];

  const offset = (page - 1) * PAGE_SIZE;
  try {
    [yearCounts, rows, total, recPosts] = await Promise.all([
      listYearCounts(),
      listPublishedPage(PAGE_SIZE, offset, undefined, wantedYear || undefined),
      countPublished(undefined, wantedYear || undefined),
      listRecommended(),
    ]);
  } catch {
    /* 忽略，页面下方会显示空态 */
  }

  const years = yearCounts.map((r) => r.y);
  const activeYear = years.includes(wantedYear) ? wantedYear : "";
  const grandTotal = yearCounts.reduce((sum, r) => sum + r.n, 0);
  const recommend = recPosts.length
    ? recPosts
    : await listLatest(5).catch(() => [] as PostMeta[]);

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-4 py-6 md:px-6 md:py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16 with-aside">
        <div className="min-w-0 main-col">
          <h1 className="text-2xl font-bold text-[var(--c-text)]">历史文章</h1>
          <span className="mt-2 block h-[3px] w-14 rounded-sm bg-[var(--brand)]" />
          <p className="mt-3 text-sm text-[var(--c-text-3)]">
            共 {grandTotal} 篇 · 按发布时间归档
          </p>

          {/* 年份标签 */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-[var(--c-border-2)] pb-3">
            <Link href="/history" className={chip(!activeYear)}>
              全部
            </Link>
            {years.map((y) => (
              <Link
                key={y}
                href={`/history?year=${y}`}
                className={chip(activeYear === y)}
              >
                {y}年
              </Link>
            ))}
          </div>

          {total === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--c-text-4)]">
              暂无文章
            </p>
          ) : (
            <PagedPostList
              key={activeYear || "all"}
              initialPosts={rows}
              total={total}
              page={page}
              year={activeYear || undefined}
            />
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
