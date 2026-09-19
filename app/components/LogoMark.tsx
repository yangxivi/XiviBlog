/**
 * 站点 LOGO 方块：黄底 + 深色文字（学美团那种「黄底方角块 + 粗黑字」）。
 * 固定正方形（32×32）；方块里的字与右侧站名「曦微博客」用同一套字体类，
 * 保证字体、字重、字距、字号完全一致；多字时按字数等比缩小，避免挤出方块。
 */

/** 头部站名的字体样式——LOGO 里的文字直接复用它，改这一处两边同步 */
export const BRAND_TEXT_CLASS = "text-[1.3rem] font-semibold tracking-tight";

/** 1.3rem = 20.8px，与 BRAND_TEXT_CLASS 的字号对应 */
export const BRAND_FONT_SIZE = 20.8;

const BOX = 32; // 方块边长 px（与 h-8 w-8 一致）
const PAD = 5; // 左右各留的呼吸位 px

export default function LogoMark({
  text,
  fontClass = BRAND_TEXT_CLASS,
  size = BRAND_FONT_SIZE,
  className,
}: {
  text: string;
  /** 与相邻站名一致的字体/字重/字距类 */
  fontClass?: string;
  /** 与相邻站名字号一致的基准 px */
  size?: number;
  /** 可选额外 Tailwind 类，叠加到根 span（如 h-6 w-6 缩小尺寸） */
  className?: string;
}) {
  const t = (text || "曦微").trim();
  const chars = Array.from(t);
  // 多字时按可用宽度等比缩小，单字则严格与站名同号
  const fit = (BOX - PAD * 2) / Math.max(chars.length, 1);
  const fontSize = chars.length > 1 ? Math.min(size, fit) : size;
  const gap = chars.length > 1 ? 1 : 0;

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[9px] bg-[var(--brand)] leading-none text-[var(--brand-ink)] ${fontClass} ${className || "h-8 w-8"}`}
      style={{ fontSize }}
    >
      {chars.map((c, i) => (
        <span key={i} style={{ marginLeft: i ? gap : 0 }}>
          {c}
        </span>
      ))}
    </span>
  );
}
