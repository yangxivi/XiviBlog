import Link from "next/link";
import LogoMark from "./LogoMark";
import CoverThumb from "./CoverThumb";
import type { PromoCard } from "@/lib/settings";

const WRAP: Record<PromoCard["variant"], string> = {
  outline: "rounded-2xl border-2 border-[var(--brand)] bg-[var(--c-card)]",
  brand: "rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)]",
  dark: "rounded-2xl border border-[var(--c-border)] bg-[var(--c-invert)]",
  plain: "rounded-2xl border-2 border-[var(--c-border-2)] bg-[var(--c-card)]",
};

/** 有图时图片自己撑满，不要额外内边距 */
const PAD: Record<PromoCard["variant"], string> = {
  outline: "p-4",
  brand: "p-5",
  dark: "p-5",
  plain: "p-5",
};

/** 品牌卡（黄底渐变）与深色卡都用固定文字色，不随明暗主题变 */
const BADGE: Record<PromoCard["variant"], string> = {
  outline: "text-[var(--c-text-3)]",
  brand: "text-[var(--brand-ink)]/70",
  dark: "text-white/60",
  plain: "text-[var(--c-text-3)]",
};

const TITLE: Record<PromoCard["variant"], string> = {
  outline: "text-[var(--c-text)]",
  brand: "text-[var(--brand-ink)]",
  dark: "text-white",
  plain: "text-[var(--c-text)]",
};

const SUB: Record<PromoCard["variant"], string> = {
  outline: "text-[var(--c-text-3)]",
  brand: "text-[var(--brand-ink)]/70",
  dark: "text-white/60",
  plain: "text-[var(--c-text-3)]",
};

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

/** 侧边栏橱窗位，内容全部来自后台「站点设置 → 侧边橱窗」 */
export default function PromoStack({
  cards,
  logoText,
}: {
  cards: PromoCard[];
  logoText: string;
}) {
  if (!cards?.length) return null;

  return (
    <div className="space-y-5">
      {cards.map((c, idx) => {
        const lines = c.title.split("\n").map((l) => l.trim()).filter(Boolean);
        const isOutline = c.variant === "outline";
        const hasText = lines.length > 0 || !!c.badge || !!c.subtitle;

        const body = (
          <>
            {/* 橱窗卡是站长自己的宣传图，不加 XIVI 水印；contain 完整显示、居中不裁切 */}
            {c.image && (
              <CoverThumb
                src={c.image}
                className="h-[92px] w-full"
                watermark={false}
                fit="contain"
              />
            )}
            {hasText && (
              <div className={c.image ? "p-4" : ""}>
              {isOutline ? (
                <div className="flex items-center gap-3">
                  <LogoMark text={logoText} />
                  <div className="min-w-0">
                    {lines.map((l, i) => (
                      <p
                        key={i}
                        className={`text-[12px] font-bold leading-snug tracking-wide ${TITLE[c.variant]}`}
                      >
                        {l}
                      </p>
                    ))}
                    {c.subtitle && (
                      <p className={`mt-0.5 text-xs ${SUB[c.variant]}`}>
                        {c.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {c.badge && (
                    <p className={`text-xs font-medium ${BADGE[c.variant]}`}>
                      {c.badge}
                    </p>
                  )}
                  <h4
                    className={`text-base font-bold leading-snug ${TITLE[c.variant]} ${
                      c.badge ? "mt-1" : ""
                    }`}
                  >
                    {lines.map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  </h4>
                  {c.subtitle && (
                    <p className={`mt-1.5 text-xs ${SUB[c.variant]}`}>
                      {c.subtitle}
                    </p>
                  )}
                </>
              )}
              </div>
            )}
          </>
        );

        const base = `block overflow-hidden transition ${WRAP[c.variant]} ${
          c.image ? "" : PAD[c.variant]
        }`;

        if (!c.href) {
          return (
            <div key={idx} className={base}>
              {body}
            </div>
          );
        }

        return isExternal(c.href) ? (
          <a
            key={idx}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${base} hover:brightness-105`}
          >
            {body}
          </a>
        ) : (
          <Link key={idx} href={c.href} className={`${base} hover:brightness-105`}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
