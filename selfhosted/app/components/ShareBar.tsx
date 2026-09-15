"use client";

import { useEffect, useState } from "react";

type Props = {
  title: string;
  /** 站点根地址，如 https://blog.aixivi.cn */
  origin: string;
  slug: string;
  excerpt?: string;
  cover?: string;
};

/** 微信没有网页分享接口，统一走「复制链接去微信粘贴」 */
export default function ShareBar({ title, origin, slug, excerpt = "" }: Props) {
  const [tip, setTip] = useState("");
  const url = `${origin}/blog/${encodeURIComponent(slug)}`;
  const eTitle = encodeURIComponent(title);
  const eUrl = encodeURIComponent(url);

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(""), 2200);
    return () => clearTimeout(t);
  }, [tip]);

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setTip(msg);
    } catch {
      // 非安全上下文 / 无剪贴板权限时的兜底
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setTip(msg);
      } catch {
        setTip("复制失败，请手动复制地址栏");
      }
      ta.remove();
    }
  }

  const links = [
    {
      label: "微博",
      href: `https://service.weibo.com/share/share.php?url=${eUrl}&title=${eTitle}`,
      icon: (
        <path d="M9.8 20.5c-4 0-7.3-1.9-7.3-4.4 0-1.3.8-2.8 2.3-4.1C7 10.1 9.3 9 11.2 9c.7 0 1.3.1 1.8.3.5-1 .9-2.2.9-3 0-1-.4-1.5-1.2-1.5-1.9 0-4.4 2.6-4.4 4.3 0 .4.1.7.3 1-1.7.8-3.6 2.4-3.6 4.3 0 2.4 2.6 4.1 5.6 4.1 3.3 0 5.7-2 5.7-4 0-1-.6-1.9-1.6-2.4.2-.5.3-1 .3-1.5 0-2.3-2.4-2.9-4.4-2.6v-.1c2.6-.7 5.3.5 5.3 2.6 0 .5-.1 1-.4 1.5 1.4.5 2.3 1.5 2.3 2.7 0 2.3-2.6 4.3-5.6 4.3h-.5z" />
      ),
    },
    {
      label: "QQ",
      href: `https://connect.qq.com/widget/shareqq/index.html?url=${eUrl}&title=${eTitle}`,
      icon: (
        <path d="M12 2C8.7 2 6.3 4.6 6.3 8c0 .9-.3 1.6-.8 2.4-.9 1.4-1.7 2.6-1.4 4.3.2 1.2 1.2 1.4 1.9.9.5.9 1.4 1.9 2.5 2.5-.3.3-.5.6-.6 1-.2.5.3.9.9.7.8-.3 1.8-.5 3.2-.5s2.4.2 3.2.5c.6.2 1.1-.2.9-.7-.1-.4-.3-.7-.6-1 1.1-.6 2-1.6 2.5-2.5.7.5 1.7.3 1.9-.9.3-1.7-.5-2.9-1.4-4.3-.5-.8-.8-1.5-.8-2.4C18.7 4.6 16.3 2 13 2h-1z" />
      ),
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${eUrl}&text=${eTitle}`,
      icon: (
        <path d="M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.7 21h-3l7-8L2.5 3h6.1l4.2 5.6L17.5 3zm-1 16h1.7L7.6 4.8H5.8L16.5 19z" />
      ),
    },
  ];

  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] px-4 py-3">
      <span className="mr-1 text-xs font-medium text-[var(--c-text-3)]">分享</span>

      <button
        type="button"
        onClick={() => copy(url, "链接已复制，去粘贴给朋友吧")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-1.5 text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M3.9 12a5 5 0 0 1 5-5h3V5h-3a7 7 0 0 0 0 14h3v-2h-3a5 5 0 0 1-5-5zm4 1h8v-2H7.9v2zm9-8h-3v2h3a5 5 0 0 1 0 10h-3v2h3a7 7 0 0 0 0-14z" />
        </svg>
        复制链接
      </button>

      <button
        type="button"
        onClick={() =>
          copy(`【${title}】\n${excerpt ? excerpt + "\n" : ""}${url}`, "已复制标题 + 链接，可直接发微信")
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-1.5 text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M8.7 3C4.9 3 2 5.5 2 8.6c0 1.8 1 3.3 2.5 4.4l-.6 1.9 2.2-1.1c.8.2 1.5.4 2.3.4h.5a5.6 5.6 0 0 1-.2-1.5c0-3 2.9-5.4 6.4-5.4h.5C15.2 5 12.2 3 8.7 3zm-2.3 3c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm4.5 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z" />
          <path d="M22 13.7c0-2.6-2.5-4.7-5.7-4.7s-5.7 2.1-5.7 4.7 2.5 4.7 5.7 4.7c.7 0 1.3-.1 1.9-.3l1.8.9-.5-1.6c1.5-.9 2.5-2.2 2.5-3.7zm-7.6-.8c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7zm3.7 0c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7z" />
        </svg>
        微信文案
      </button>

      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-1.5 text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            {l.icon}
          </svg>
          {l.label}
        </a>
      ))}

      {tip && (
        <span className="ml-1 text-xs text-[var(--brand-deep)]" role="status">
          {tip}
        </span>
      )}
    </div>
  );
}
