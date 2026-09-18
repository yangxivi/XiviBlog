import Link from "next/link";
import type { ReactNode } from "react";
import LogoMark from "./LogoMark";
import type { LinkItem, SiteSettings } from "@/lib/settings";
import { nextMemorial, type MemorialDay } from "@/lib/memorial";

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
 * 提醒文案：今天 / 明天 / 还有几天，三种语气略有区分。
 * 触发时机由后台设置 `memorialLeadDays` 控制（0 = 仅当天）。
 */
function memorialNoticeText(day: MemorialDay, inDays: number): string {
  if (inDays === 0) return `今天是${day.name}，本站以素灰致哀`;
  if (inDays === 1) return `明天是${day.name}，本站将以素灰致哀`;
  return `${inDays} 天后是${day.name}（${day.md}）`;
}

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

  // 临近公祭日时在页脚最底部露一行提醒（后台关掉自动公祭则不显示）。
  // 与 layout.tsx 同一套东八区口径，避免边缘节点时区导致文案和整站变灰不同步。
  // memorialLeadDays 已在 normalizeSettings 里夹到 0-60，这里可直接比较。
  const upcoming = settings.memorialAuto ? nextMemorial(settings.memorialDays) : null;
  const memorialNotice =
    upcoming && upcoming.inDays <= settings.memorialLeadDays
      ? memorialNoticeText(upcoming.day, upcoming.inDays)
      : null;

  return (
    // mt-auto：body 是 flex 列，把页脚顶到最底部（main 的 flex-1 之外的双保险），
    // 内容不足一屏时页脚下方也不会露出空白
    <footer className="mt-auto border-t border-[var(--c-border)] bg-[var(--c-soft)]">
      {/* 横向内边距与正文容器一致（px-6）：品牌区左缘才能与侧栏/文章列表
          第一条左参考线重合（原本 lg:px-8 会比正文右偏 8px） */}
      <div className="mx-auto max-w-[var(--page-outer)] px-4 py-8 md:px-6 md:py-10">
        {/*
          两个独立区块并排：品牌区（含二维码） + 链接分组。
          - 品牌区左缘 = 容器左缘，即侧栏在左时与侧栏左侧对齐、
            侧栏在右时与文章列表左侧对齐；
          - 链接分组左缘由 globals.css 里 footer-cols 的侧栏在左分支负责：
            把品牌列调宽，使第一组链接正好落在正文主列（文章列表/上一页按钮）左缘。
        */}
        <div className="footer-cols grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-5 lg:gap-x-10">
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
            {/* 页脚二维码模块：最多 2 张，与站名/简介同属品牌区，标题在图下 */}
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

          {settings.footerColumns.map((col, i) => (
            <div key={`${col.title}-${i}`} className="min-w-0">
              {/* 与品牌区标题「曦微博客」同一水平线：外层撑到 32px（= 品牌 LOGO 方块高）
                  并垂直居中；字号/字重/字距与品牌标题保持一致 */}
              <div className="flex h-8 items-center">
                <h4 className="text-[15px] font-bold tracking-tight text-[var(--brand)]">
                  {col.title}
                </h4>
              </div>
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

        {/* 公祭日提醒：居中一行小字，仅临近时出现；不打断上面三栏的对齐关系 */}
        {memorialNotice && (
          <p className="mt-4 text-center text-xs text-[var(--c-text-4)]">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-[var(--c-text-4)]"
              />
              {memorialNotice}
            </span>
          </p>
        )}
      </div>
    </footer>
  );
}
