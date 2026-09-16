import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteAside from "@/app/components/SiteAside";
import Comments from "@/app/components/Comments";
import AdminEditButton from "@/app/components/AdminEditButton";
import { listLatest, listRecommended, safeDecode, type PostMeta } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getPageBySlug } from "@/lib/pages";
import { renderMarkdown } from "@/lib/markdown";

/** 自定义页面（留言板、友链页等），内容由后台「页面管理」维护 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = safeDecode(rawSlug);
  const page = await getPageBySlug(slug).catch(() => null);
  if (!page) return { title: "页面未找到" };
  return {
    title: page.title,
    description: page.title,
  };
}

export default async function CustomPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = safeDecode(rawSlug);
  const page = await getPageBySlug(slug).catch(() => null);
  if (!page) notFound();

  const settings = await getSettings();

  let posts: PostMeta[] = [];
  let recPosts: PostMeta[] = [];
  try {
    posts = await listLatest(5);
    recPosts = await listRecommended();
  } catch {
    /* 侧栏属附加内容，失败不影响正文 */
  }
  const recommend = recPosts.length ? recPosts : posts.slice(0, 5);

  const pageKey = `page:${page.slug}`;

  return (
    <div>
      {/* 黄底横幅（整屏通栏） */}
      <section className="bg-gradient-to-b from-[var(--c-brand-tint)] to-[var(--c-page)] px-4 py-12 text-center md:px-6 md:py-16">
        <h1 className="text-3xl font-black tracking-tight text-[var(--c-text)] sm:text-4xl">
          {page.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--c-text-2)]">
          {settings.siteName}
        </p>
      </section>

      {/* 正文：与首页/关于页共用同一套容器与两栏栅格 */}
      <div className="mx-auto max-w-[var(--page-outer)] px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
          <div className="min-w-0 main-col">
            <div className="rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-8 sm:p-10">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-[var(--c-text)]">{page.title}</h2>
                <AdminEditButton href={`/admin/pages/edit/${page.id}`} label="编辑" />
              </div>

              <div
                className="prose-xivi mt-2 text-[15px]"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(page.content || ""),
                }}
              />
            </div>

            {/* 留言板：仅在页面开启「允许留言」时显示 */}
            {page.allow_comments === 1 && (
              <Comments
                pageKey={pageKey}
                placeholder="在这条页面下留个言吧…（免注册，系统自动生成昵称头像）"
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
    </div>
  );
}
