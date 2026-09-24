"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type Slide = {
  key: string;
  title: string;
  excerpt?: string;
  badge?: string;
  image?: string;
  href: string;
};

const gradients = [
  "from-[var(--brand)] to-[var(--brand-2)]",
  "from-blue-400 to-indigo-600",
  "from-violet-400 to-fuchsia-600",
  "from-amber-400 to-orange-600",
  "from-cyan-400 to-sky-600",
];

function gradientFor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return gradients[sum % gradients.length];
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

/** 站内用 Link，站外用 <a target=_blank> */
export function SlideLink({
  href,
  className,
  children,
  onMouseEnter,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onMouseEnter?: () => void;
}) {
  if (isExternal(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onMouseEnter={onMouseEnter}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href || "/"}
      className={className}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </Link>
  );
}

/** 受控轮播：索引由父组件持有，便于与「最新动态」列表联动 */
export default function Carousel({
  slides,
  index,
  onChange,
  onHover,
}: {
  slides: Slide[];
  index: number;
  onChange: (i: number) => void;
  onHover?: (hovering: boolean) => void;
}) {
  const n = slides.length;
  if (n === 0) return null;

  const idx = ((index % n) + n) % n;
  const go = (i: number) => onChange(((i % n) + n) % n);

  return (
    <section
      className="group relative overflow-hidden rounded-2xl border border-[var(--c-border-2)] shadow-sm"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div className="relative h-[220px] w-full bg-[var(--c-card)] sm:h-[280px] lg:h-[360px]">
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              i === idx ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <SlideLink href={s.href} className="group/slide block h-full w-full">
              {s.image ? (
                <img
                  src={s.image}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover/slide:scale-[1.02]"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding="async"
                />
              ) : (
                <div
                  className={`h-full w-full bg-gradient-to-br ${gradientFor(
                    s.title || s.key
                  )}`}
                />
              )}

              {/* 底部渐变遮罩：padding 40/20/20 + to top rgba(0,0,0,.8) */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-10 text-left">
                {s.badge && (
                  <span className="mb-[5px] inline-flex items-center rounded-full bg-[var(--brand)] px-2.5 py-1 text-xs font-bold text-[var(--brand-ink)]">
                    {s.badge}
                  </span>
                )}
                <h3 className="mb-[5px] line-clamp-2 text-2xl font-bold leading-[1.35] text-white">
                  {s.title}
                </h3>
                {s.excerpt && (
                  <p
                    title={s.excerpt}
                    className="truncate text-base leading-snug text-white/90"
                  >
                    {s.excerpt}
                  </p>
                )}
              </div>
            </SlideLink>
          </div>
        ))}
      </div>

      {/* 左右箭头 */}
      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={() => go(idx - 1)}
            className="absolute left-2.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-100 transition hover:bg-black/60 md:opacity-0 md:group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={() => go(idx + 1)}
            className="absolute right-2.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-100 transition hover:bg-black/60 md:opacity-0 md:group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />
            </svg>
          </button>
        </>
      )}

      {/* 圆点指示器 */}
      {n > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`第 ${i + 1} 张`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
