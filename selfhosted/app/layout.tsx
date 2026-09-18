import type { Metadata } from "next";
import Link from "next/link";
import Footer from "./components/Footer";
import LogoMark, { BRAND_TEXT_CLASS } from "./components/LogoMark";
import Nav from "./components/Nav";
import NoticeBar from "./components/NoticeBar";
import SidebarToggle from "./components/SidebarToggle";
import BackToTop from "./components/BackToTop";
import ThemeToggle from "./components/ThemeToggle";
import ViewTracker from "./components/ViewTracker";
import ScrollToTop from "./components/ScrollToTop";
import { getSettings, type LinkItem } from "@/lib/settings";
import { MEMORIAL_THEME_ID, memorialToday } from "@/lib/memorial";
import { isAuthenticated } from "@/lib/auth";
import { countUsers } from "@/lib/users";
import { listNavPages } from "@/lib/pages";
import { AdminProvider } from "./components/AdminContext";
import "./globals.css";

/** 站点名称、导航、页脚都由数据库设置驱动，必须按请求渲染 */
export const dynamic = "force-dynamic";

const FALLBACK_SITE = "曦微博客";
const FALLBACK_DESC =
  "曦微（XIVI）的技术博客：AI 应用、桌面工具、自动化脚本与部署实践。";

/**
 * 站点名称 / 描述跟随后台设置实时变化：用 generateMetadata 从数据库读取。
 * 构建期 / 运行期获取不到设置时回落默认值，不影响渲染与构建。
 */
export async function generateMetadata(): Promise<Metadata> {
  let site = process.env.SITE_NAME || "";
  let desc = "";
  if (!site) {
    try {
      const s = await getSettings();
      site = s.siteName || FALLBACK_SITE;
      desc = s.siteDesc || "";
    } catch {
      site = FALLBACK_SITE;
    }
  }
  const description = desc || FALLBACK_DESC;
  return {
    metadataBase: new URL(process.env.SITE_URL || "https://blog.aixivi.cn"),
    title: {
      default: site,
      template: `%s | ${site}`,
    },
    description,
    alternates: {
      canonical: "/",
      types: {
        "application/rss+xml": [{ url: "/rss.xml", title: `${site} RSS` }],
      },
    },
    openGraph: {
      type: "website",
      siteName: site,
      title: site,
      description,
      locale: "zh_CN",
    },
  };
}

/** 首屏绘制前恢复主题，避免暗色用户看到白屏闪烁 */
const THEME_INIT = `(function(){try{var s=localStorage.getItem('xivi-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

/** 首屏绘制前恢复侧边栏位置（左/右），避免刷新后位置闪动 */
const SIDEBAR_INIT = `(function(){try{var s=localStorage.getItem('xivi-sidebar');if(s!=='left'&&s!=='right')s='right';document.documentElement.setAttribute('data-sidebar',s);}catch(e){document.documentElement.setAttribute('data-sidebar','right');}})();`;

/** 首屏强制回到最顶部，避免浏览器恢复上次滚动位置导致一打开页面卡在中间
    （新布局下滚动发生在 #xivi-main 容器内部，所以要一并重置） */
const SCROLL_INIT = `(function(){try{if(!window.location.hash){window.scrollTo(0,0);var m=document.getElementById('xivi-main');if(m)m.scrollTop=0;}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 未安装（users 表为空，或表尚未建立）时输出「裸」布局：只有安装向导本身，
  // 不渲染导航 / 搜索 / 公告 / 悬浮按钮 / 页脚等任何站点元素。
  const installed = (await countUsers().catch(() => 0)) > 0;
  if (!installed) {
    return (
      <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
        <body className="flex min-h-dvh flex-col bg-[var(--c-page)] text-[var(--c-text)]">
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

  // 国家公祭日：命中纪念日当天，整站强制切到「纪念灰」并整体去色，
  // 覆盖站长手动选定的主题（这是公祭日的刚性要求，不是个性化偏好）。
  // 日期按东八区判定，见 lib/memorial.ts。
  const memorial = settings.memorialAuto
    ? memorialToday(settings.memorialDays)
    : null;
  const effectiveTheme = memorial
    ? MEMORIAL_THEME_ID
    : (settings.theme ?? "meituan");

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      data-sidebar="right"
      data-theme={effectiveTheme}
      data-memorial={memorial ? "1" : undefined}
      suppressHydrationWarning
    >
      {/* 全站布局（2026-09-17 重构，前台后台共用）：
          body 定高一屏 + overflow-hidden → 文档级永不滚动，物理上杜绝「滚过页脚下边框」；
          header / 公告条固定在顶部（shrink-0），main 是唯一滚动容器（id=xivi-main，
          全站滚动相关脚本都通过它驱动），页脚放在滚动内容末尾——
          内容不够长时也能滑出一小段把页脚带出来，滚动终点恰好是页脚下边框，天然锁死。 */}
      <body className="relative flex h-dvh flex-col overflow-hidden bg-[var(--c-page)] text-[var(--c-text)]">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: SCROLL_INIT }} />
        <header className="z-50 shrink-0 border-b border-[var(--c-border)] bg-[var(--c-header)] backdrop-blur">
          <div className="relative mx-auto grid h-[3.6rem] max-w-[var(--page-outer)] grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 lg:px-8">
            {/* min-w-0 允许在窄视口被压缩；站名 truncate 防止换行撑出页头压到公告栏 */}
            <Link
              href="/"
              className="flex min-w-0 shrink-0 items-center gap-2 justify-self-start md:gap-2.5"
            >
              <LogoMark text={settings.logoText} fontClass={BRAND_TEXT_CLASS} />
              <span
                className={`${BRAND_TEXT_CLASS} hidden truncate text-[var(--c-text)] sm:inline`}
              >
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
          <main
            id="xivi-main"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          >
            {/* min-h-full：内容区至少撑满滚动容器一屏 → 页脚始终从视口外「带出来」，
                滚到底时页脚下边框与视口底边精确重合，再往下无可滚动距离（锁死） */}
            <div className="min-h-full">{children}</div>
            <Footer settings={settings} />
          </main>
        </AdminProvider>

        <BackToTop />
        <ThemeToggle />
        <ViewTracker />
        <ScrollToTop />
      </body>
    </html>
  );
}
