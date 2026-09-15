import type { Metadata } from "next";
import Link from "next/link";
import Footer from "./components/Footer";
import LogoMark, { BRAND_TEXT_CLASS } from "./components/LogoMark";
import Nav from "./components/Nav";
import NoticeBar from "./components/NoticeBar";
import ScrollLock from "./components/ScrollLock";
import SideAd from "./components/SideAd";
import SidebarToggle from "./components/SidebarToggle";
import BackToTop from "./components/BackToTop";
import ThemeToggle from "./components/ThemeToggle";
import ViewTracker from "./components/ViewTracker";
import ScrollToTop from "./components/ScrollToTop";
import { getSettings, type LinkItem } from "@/lib/settings";
import { isAuthenticated } from "@/lib/auth";
import { countUsers } from "@/lib/users";
import { listNavPages } from "@/lib/pages";
import { AdminProvider } from "./components/AdminContext";
import "./globals.css";

/** 站点名称、导航、页脚都由数据库设置驱动，必须按请求渲染 */
export const dynamic = "force-dynamic";

/**
 * 用静态 metadata 而非 generateMetadata 函数：
 * Next 16.3.4 在预渲染内部 /_global-error 页时会为 generateMetadata 建立
 * searchParams 的 workStore，而该页无请求上下文 → 抛 InvariantError 导致 build 失败。
 * 静态导出不会触发该路径。站点名可在构建期用 SITE_NAME 环境变量覆盖。
 */
const SITE = process.env.SITE_NAME || "曦微博客";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://blog.aixivi.cn"),
  title: {
    default: SITE,
    template: `%s | ${SITE}`,
  },
  description: "曦微（XIVI）的技术博客：AI 应用、桌面工具、自动化脚本与部署实践。",
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: `${SITE} RSS` }],
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE,
    title: SITE,
    description: "曦微（XIVI）的技术博客：AI 应用、桌面工具、自动化脚本与部署实践。",
    locale: "zh_CN",
  },
};

/** 首屏绘制前恢复主题，避免暗色用户看到白屏闪烁 */
const THEME_INIT = `(function(){try{var s=localStorage.getItem('xivi-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

/** 首屏绘制前恢复侧边栏位置（左/右），避免刷新后位置闪动 */
const SIDEBAR_INIT = `(function(){try{var s=localStorage.getItem('xivi-sidebar');if(s!=='left'&&s!=='right')s='right';document.documentElement.setAttribute('data-sidebar',s);}catch(e){document.documentElement.setAttribute('data-sidebar','right');}})();`;

/** 首屏强制回到最顶部，避免浏览器恢复上次滚动位置导致一打开页面卡在中间 */
const SCROLL_INIT = `(function(){try{if(!window.location.hash){window.scrollTo(0,0);}}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 未安装（users 表为空，或表尚未建立）时输出「裸」布局：只有安装向导本身，
  // 不渲染导航 / 搜索 / 公告 / 悬浮按钮 / 页脚等任何站点元素。
  const installed = (await countUsers().catch(() => 0)) > 0;
  if (!installed) {
    return (
      <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
        <body className="flex min-h-full flex-col bg-[var(--c-page)] text-[var(--c-text)]">
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
          {children}
        </body>
      </html>
    );
  }

  const settings = await getSettings();
  const isAdmin = await isAuthenticated();

  // 自定义页面中勾选「显示在导航」的，追加到顶部导航
  const pageNav: LinkItem[] = (await listNavPages()).map((p) => ({
    label: p.title,
    href: `/${p.slug}`,
  }));
  const navItems: LinkItem[] = [...settings.nav, ...pageNav];

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      data-sidebar="right"
      data-theme={settings.theme ?? "meituan"}
      suppressHydrationWarning
    >
      {/* relative：作为停靠按钮（absolute）的定位参照，锚定文档底部而非初始包含块 */}
      <body className="relative flex min-h-full flex-col bg-[var(--c-page)] text-[var(--c-text)]">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: SCROLL_INIT }} />
        <header className="sticky top-0 z-50 border-b border-[var(--c-border)] bg-[var(--c-header)] backdrop-blur">
          <div className="relative mx-auto grid h-[3.6rem] max-w-[var(--page-outer)] grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 lg:px-8">
            <Link href="/" className="flex shrink-0 items-center gap-2 justify-self-start md:gap-2.5">
              <LogoMark text={settings.logoText} fontClass={BRAND_TEXT_CLASS} />
              <span className={`${BRAND_TEXT_CLASS} hidden text-[var(--c-text)] sm:inline`}>
                {settings.siteName}
              </span>
            </Link>

            <div className="justify-self-center">
              <Nav items={navItems} />
            </div>

            <div className="flex items-center gap-1.5 justify-self-end md:gap-2">
              <form action="/search" className="flex items-center">
                <div className="flex items-center gap-2 rounded-full bg-[var(--c-fill)] px-3 py-2 transition focus-within:bg-[var(--c-card)] focus-within:ring-1 focus-within:ring-[var(--brand)] md:px-4">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-[var(--c-text-3)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.6-3.6" strokeLinecap="round" />
                  </svg>
                  <input
                    name="q"
                    placeholder="搜索"
                    className="w-20 bg-transparent text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-3)] sm:w-28 md:w-40"
                  />
                </div>
              </form>
              <div className="hidden lg:block">
                <SidebarToggle />
              </div>
            </div>
          </div>
        </header>

        <NoticeBar notice={settings.notice} />

        <AdminProvider isAdmin={isAdmin}>
          <main className="flex-1">{children}</main>
        </AdminProvider>

        <SideAd />
        <ScrollLock />
        <BackToTop />
        <ThemeToggle />
        <ViewTracker />
        <ScrollToTop />

        <Footer settings={settings} />
      </body>
    </html>
  );
}
