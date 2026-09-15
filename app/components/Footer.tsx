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
    <footer className="border-t border-[var(--c-border)] bg-[var(--c-soft)]">
      <div className="mx-auto max-w-[var(--page-outer)] px-4 py-10 md:px-6 md:py-12">
        {/* 移动端：品牌独占一行，下面 4 列 2×2；桌面端：5 等分，加大品牌与分组间距 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-5 lg:gap-x-10">
          <div className="col-span-2 min-w-0 lg:col-span-1">
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
          </div>

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
