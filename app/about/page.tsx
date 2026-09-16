import type { Metadata } from "next";
import SiteAside from "@/app/components/SiteAside";
import Comments from "@/app/components/Comments";
import AdminEditButton from "@/app/components/AdminEditButton";
import { listLatest, listRecommended, type PostMeta } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getPageBySlug } from "@/lib/pages";
import { renderMarkdown } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "关于我们",
  description: "关于曦微 XIVI 与这个博客。",
};

/** 与其他标签页一致：设置驱动侧栏，按请求渲染 */
export const dynamic = "force-dynamic";

export default async function About() {
  const settings = await getSettings();
  const aboutPage = await getPageBySlug("about").catch(() => null);

  let posts: PostMeta[] = [];
  let recPosts: PostMeta[] = [];
  try {
    posts = await listLatest(5);
    recPosts = await listRecommended();
  } catch {
    /* 侧栏属附加内容，失败不影响正文 */
  }
  const recommend = recPosts.length ? recPosts : posts.slice(0, 5);

  const title = aboutPage?.title || settings.aboutTitle || "关于这个博客";
  const content = aboutPage?.content || settings.aboutContent;

  return (
    <div>
      {/* 黄底横幅（整屏通栏）；页眉文案在「页面管理 → about」编辑器里维护 */}
      <section className="bg-gradient-to-b from-[var(--c-brand-tint)] to-[var(--c-page)] px-4 py-12 text-center md:px-6 md:py-16">
        <h1 className="text-3xl font-black tracking-tight text-[var(--c-text)] sm:text-4xl">
          {aboutPage?.header_title || settings.siteName}
        </h1>
        {(aboutPage ? aboutPage.header_tagline : "") && (
          <p className="mt-4 text-lg font-bold text-[var(--c-text)]">
            {aboutPage?.header_tagline}
          </p>
        )}
        {(aboutPage ? aboutPage.header_desc : "") && (
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--c-text-2)]">
            {aboutPage?.header_desc}
          </p>
        )}
      </section>

      {/* 正文：与首页/历史/搜索共用同一套容器与两栏栅格 */}
      <div className="mx-auto max-w-[var(--page-outer)] px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
          <div className="min-w-0 main-col">
            <div className="rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-8 sm:p-10">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-center text-xl font-bold text-[var(--c-text)]">
                  {title}
                </h2>
                {aboutPage ? (
                  <AdminEditButton
                    href={`/admin/pages/edit/${aboutPage.id}`}
                    label="编辑"
                  />
                ) : null}
              </div>

              {content ? (
                /* 正文由后台「页面管理 → about」维护（Markdown 实时预览） */
                <div
                  className="prose-xivi mt-6 text-[15px]"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(content),
                  }}
                />
              ) : (
                <div className="prose-xivi mt-6 text-[15px]">
                  <p>
                    曦微（XIVI）是我的个人品牌，这个博客用来沉淀日常折腾的成果与踩坑记录。
                    内容围绕 AI 应用、Windows 桌面工具、自动化脚本与各类部署实践展开。
                  </p>

                  <h2>技术栈</h2>
                  <ul>
                    <li>Next.js 16（App Router）+ TypeScript + Tailwind CSS v4</li>
                    <li>Cloudflare Workers（经 OpenNext 适配层）</li>
                    <li>Cloudflare D1（SQLite）承载文章数据</li>
                    <li>自建 HMAC 签名 Cookie 鉴权 + 后台管理</li>
                  </ul>

                  <h2>偏好</h2>
                  <p>
                    能自动化的绝不手动，能免费的绝不付费。选型时优先零成本、零注册摩擦、部署完就能忘掉的方案。
                  </p>
                </div>
              )}
            </div>

            {/* 关于页留言板（免注册） */}
            <Comments pageKey="about" placeholder="留个言吧…（免注册，系统自动生成昵称头像）" />
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
