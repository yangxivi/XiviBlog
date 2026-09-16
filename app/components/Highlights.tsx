"use client";

import { useEffect, useState } from "react";
import Carousel, { SlideLink, type Slide } from "./Carousel";

/** 轮播侧边排名数字颜色：与「推荐阅读」组件保持一致 */
const TOP_RANK = [
  "from-[#FF4D4F] to-[#FF7A45]",
  "from-[#FF7A45] to-[#FFA940]",
  "from-[var(--brand-2)] to-[var(--brand)]",
];

function RankBadge({ n }: { n: number }) {
  const i = n - 1;
  return (
    <span
      className={`shrink-0 text-center font-[Georgia,serif] text-[1.5rem] font-bold italic leading-none ${
        i < 3
          ? `bg-gradient-to-br ${TOP_RANK[i]} bg-clip-text text-transparent`
          : "text-[#dcddde]"
      }`}
      style={{ width: "24px", marginRight: "5px" }}
    >
      {n}
    </span>
  );
}

/**
 * 首页顶部「轮播 + 最新动态」区。
 * 两者共用一个索引：鼠标悬停列表标题时，轮播会切到对应那张。
 */
export default function Highlights({
  slides,
  interval = 5,
}: {
  slides: Slide[];
  interval?: number;
}) {
  // 初始 slides 已带 cover_thumb 小图（SSR 首屏即显示真实封面，无占位图）；
  // 客户端再拉 /api/carousel 换成封面原图（240px 小图在轮播大尺寸下发糊）
  const [imgSlides, setImgSlides] = useState<Slide[]>(slides);
  const [idx, setIdx] = useState(0);
  const [hoverCarousel, setHoverCarousel] = useState(false);
  const [hoverList, setHoverList] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/carousel")
      .then((r) => r.json() as Promise<{ slides?: Slide[] }>)
      .then((d) => {
        if (alive && Array.isArray(d.slides) && d.slides.length) {
          setImgSlides(d.slides);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const n = imgSlides.length;

  useEffect(() => {
    if (n <= 1 || hoverCarousel || hoverList) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % n),
      Math.max(2, interval) * 1000
    );
    return () => clearInterval(t);
  }, [n, hoverCarousel, hoverList, interval]);

  if (n === 0) return null;

  const cur = ((idx % n) + n) % n;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-0">
      <Carousel
        slides={imgSlides}
        index={cur}
        onChange={setIdx}
        onHover={setHoverCarousel}
      />

      <div
        className="h-auto max-h-[280px] overflow-y-auto bg-[var(--c-card)] sm:max-h-[320px] lg:h-[360px] lg:max-h-none"
        onMouseEnter={() => setHoverList(true)}
        onMouseLeave={() => setHoverList(false)}
      >
        {/* 每行等高等宽、均分总高度：flex-1 撑满；行数多到装不下时才出现滚动 */}
        <ul className="flex h-full flex-col">
          {slides.map((s, i) => (
            <li key={s.key} className="flex min-h-[56px] flex-1">
              <SlideLink
                href={s.href}
                onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center overflow-hidden border-l-[3px] px-5 transition-colors ${
                  i === cur
                    ? "border-[var(--brand)] bg-[var(--c-soft)]"
                    : "border-transparent hover:bg-[var(--c-soft)]"
                }`}
              >
                <span className="mr-3 shrink-0">
                  <RankBadge n={i + 1} />
                </span>
                <span
                  title={s.title}
                  className={`line-clamp-2 text-[1.1rem] font-semibold leading-[1.4] ${
                    i === cur
                      ? "text-[var(--brand-deep)]"
                      : "text-[var(--c-text)]"
                  } sm:text-[1.25rem]`}
                >
                  {s.title.length > 15 ? s.title.slice(0, 15) + "…" : s.title}
                </span>
              </SlideLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
