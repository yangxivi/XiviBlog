import Link from "next/link";
import type { ReactNode } from "react";
import LogoMark from "./LogoMark";
import type { LinkItem, SiteSettings } from "@/lib/settings";

function isExternal(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

const LINK_CLS =
  "text-[var(--c-text-2)] transition hover:text-[var(--brand-deep)]";

/** 页脚站名样式——页脚 LOGO 里的文字复用它，与旁边站名完全一致 */
const FOOTER_BRAND_CLASS = "text-[15px] font-bold tracking-tight";

/** 底部小字里的超链接样式 */
const MINI_LINK_CLS = "transition hover:text-[var(--brand-deep)]";

/**
 * 把文本里的 [文字](链接) 与裸 URL 渲染成超链接（统一新窗口打开）。
 * 用于页脚底部的版权 / 备案号 / 备注，方便后台直接配置可点击的链接。
 */
function withLinks(text: string, keyPrefix: string): ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<> "'()]+)/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const href = m[2] || m[3];
    const label = m[1] || m[3];
    parts.push(
      <a
        key={`${keyPrefix}-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={MINI_LINK_CLS}
      >
        {label}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** 文本里是否带链接语法（[文字](url) 或裸 URL） */
function hasLink(text: string): boolean {
  return /\[([^\]]+)\]\(https?:\/\/[^\s)]+\)|https?:\/\//.test(text);
}

export function FooterLink({ item }: { item: LinkItem }) {
  if (isExternal(item.href)) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLS}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href || "/"} className={LINK_CLS}>
      {item.label}
    </Link>
  );
}

export default function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  const copyright = (settings.copyright || "").replace(
    /\{year\}/g,
    String(year)
  );

  return (
    // mt-auto：body 是 flex 列，把页脚顶到最底部（main 的 flex-1 之外的双保险），
    // 内容不足一屏时页脚下方也不会露出空白
    <footer className="mt-auto border-t border-[var(--c-border)] bg-[var(--c-soft)]">
      {/* 横向内边距与正文一致（px-6），页脚左缘与正文容器左缘对齐 */}
      <div className="mx-auto max-w-[var(--page-outer)] px-4 py-8 md:px-6 md:py-10">
        {/*
          复用正文同款 .with-aside 栅格：品牌落在「侧栏列」，四列链接落在「主列」。
          这样左侧栏时四列会自动右移一个侧栏宽度（280px + 间距），其左缘与
          「上一页按钮 / 轮播主列」左缘精确对齐；侧栏切回右侧时四列自动回到
          正文左缘，无需写死偏移量。
        */}
        <div className="with-aside grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
          {/* 品牌区（侧栏列） */}
          <div className="aside-col min-w-0">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark
                text={settings.logoText}
                fontClass={FOOTER_BRAND_CLASS}
                size={15}
              />
              <span className={`${FOOTER_BRAND_CLASS} text-[var(--c-text)]`}>
                {settings.siteName}
              </span>
            </Link>
            {settings.footerBrand && (
              <p className="mt-3 text-sm leading-6 text-[var(--c-text-3)]">
                {settings.footerBrand}
              </p>
            )}
            {/* 页脚二维码模块：最多 2 张，放在品牌区下方，标题在图下 */}
            {settings.footerQr.some((q) => q.image) && (
              <div className="mt-4 flex flex-wrap gap-4">
                {settings.footerQr
                  .filter((q) => q.image)
                  .map((q, qi) => (
                    <div key={qi} className="flex flex-col items-center">
                      <div className="h-24 w-24 overflow-hidden rounded-lg border border-[var(--c-border-3)] bg-white">
                        <img
                          src={q.image}
                          alt={q.title || "二维码"}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      {q.title && (
                        <span className="mt-1.5 text-xs text-[var(--c-text-3)]">
                          {q.title}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* 四列链接（主列）：左缘与轮播主列/上一页按钮左缘对齐（桌面 4 等分，移动端 2×2） */}
          <div className="main-col grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4 lg:gap-x-10">
            {settings.footerColumns.map((col, i) => (
              <div key={`${col.title}-${i}`} className="min-w-0">
                <h4 className="text-[13px] font-bold tracking-tight text-[var(--brand)]">
                  {col.title}
                </h4>
                <ul className="mt-3 space-y-2 text-[13px] sm:text-sm">
                  {col.links.map((l, j) => (
                    <li key={`${l.href}-${j}`} className="break-words">
                      <FooterLink item={l} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {settings.friends.length > 0 && (
          <div className="mt-10 border-t border-[var(--c-border)] pt-6">
            <h4 className="text-[15px] font-bold tracking-tight text-[var(--brand)]">
              友情链接
            </h4>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {settings.friends.map((f, i) => (
                <li key={`${f.href}-${i}`}>
                  <a
                    href={f.href}
                    target={isExternal(f.href) ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    title={f.desc || f.name}
                    className={LINK_CLS}
                  >
                    {f.name}
                    {f.desc && (
                      <span className="ml-1.5 text-xs text-[var(--c-text-4)]">
                        {f.desc}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 grid grid-cols-3 items-center gap-2 border-t border-[var(--c-border)] pt-6 text-xs text-[var(--c-text-4)]">
          <span className="min-w-0 break-words text-left">{withLinks(copyright, "cp")}</span>
          <span className="min-w-0 break-words text-center">
            {settings.icp &&
              (hasLink(settings.icp) ? (
                <span>{withLinks(settings.icp, "icp")}</span>
              ) : (
                <a
                  href="https://beian.miit.gov.cn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={MINI_LINK_CLS}
                >
                  {settings.icp}
                </a>
              ))}
          </span>
          <span className="min-w-0 break-words text-right">
            {settings.footnote && withLinks(settings.footnote, "fn")}
          </span>
        </div>
      </div>
    </footer>
  );
}
