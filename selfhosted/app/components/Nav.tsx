"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LinkItem } from "@/lib/settings";

function isExternal(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ITEM_CLS =
  "relative flex h-full items-center px-4 text-[0.9rem] font-bold transition-colors";

const MOBILE_ITEM_CLS =
  "block rounded-lg px-4 py-3 text-[0.95rem] font-bold transition-colors";

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}

export default function Nav({ items }: { items: LinkItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkNode = (item: LinkItem, mobile = false) => {
    const active = isActive(pathname, item.href);
    const cls = mobile
      ? `${MOBILE_ITEM_CLS} ${
          active
            ? "bg-[var(--c-brand-soft)] text-[var(--brand-deep)]"
            : "text-[var(--c-text)] hover:bg-[var(--c-fill)]"
        }`
      : `${ITEM_CLS} ${
          active
            ? "text-[var(--c-text)]"
            : "text-[var(--c-text-2)] hover:text-[var(--c-text)]"
        }`;

    if (isExternal(item.href)) {
      return (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
          onClick={() => mobile && setOpen(false)}
        >
          {item.label}
        </a>
      );
    }
    return (
      <Link href={item.href} className={cls} onClick={() => mobile && setOpen(false)}>
        <span className="relative">
          {item.label}
          {!mobile && active && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-full mt-[6px] h-[3px] rounded-full bg-[var(--brand)]"
            />
          )}
        </span>
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--c-text)] transition hover:bg-[var(--c-fill)] md:hidden"
      >
        <MenuIcon open={open} />
      </button>

      <nav className="hidden h-full items-center md:flex">
        <ul className="flex h-full items-center">
          {items.map((item, i) => (
            <li key={`${item.href}-${i}`} className="flex h-full">
              {linkNode(item)}
            </li>
          ))}
        </ul>
      </nav>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-[var(--c-border)] bg-[var(--c-header)] px-4 py-3 shadow-lg backdrop-blur md:hidden">
          <ul className="mx-auto max-w-[var(--page-outer)] space-y-1">
            {items.map((item, i) => (
              <li key={`mobile-${item.href}-${i}`}>{linkNode(item, true)}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
