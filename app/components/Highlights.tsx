"use client";

import { useEffect, useState } from "react";
import Carousel, { SlideLink, type Slide } from "./Carousel";

/** 轮播侧边排名数字颜色：与「推荐阅读」组件保持一致 */
const TOP_RANK = [
  "from-[#FF4D4F] to-[#FF7A45]",
  "from-[#FF7A45] to-[#FFA940]",
  "from-[var(--brand-2)] to-[var(--brand)]",
];

/**
 * 排名数字。active = 该行正压在实心主题色背景上（悬停/当前展示），
 * 此时一律用正黑：彩色渐变数字（如第 3 名的主题色渐变）压在主题色底上
 * 会直接糊成一片，浅灰数字同样发虚。
 */
function RankBadge({ n, active }: { n: number; active?: boolean }) {
  const i = n - 1;
  return (
    <span
      className={`shrink-0 text-center font-[Georgia,serif] text-[1.25rem] font-bold italic leading-none ${
        active
          ? "text-black"
          : i < 3
            ? `bg-gradient-to-br ${TOP_RANK[i]} bg-clip-text text-transparent`
            : "text-[var(--c-text-3)]"
      }`}
      style={{ width: "20px", marginRight: "6px" }}
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
  // slides 由服务端给全（文章模式下的 image 已是 /api/posts/cover 的高清原图 URL），
  // 首屏 <img> 就在 HTML 里，不再需要客户端二次换图。
  const [idx, setIdx] = useState(0);
  const [hoverCarousel, setHoverCarousel] = useState(false);
  const [hoverList, setHoverList] = useState(false);

  const imgSlides = slides;
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-5">
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
            <li key={s.key} className="flex min-h-[40px] flex-1">
              <SlideLink
                href={s.href}
                onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center overflow-hidden border-l-[3px] px-5 transition-colors ${
                  i === cur
                    ? "border-[var(--brand)] bg-[var(--brand)]"
                    : "border-transparent hover:bg-[var(--brand)]"
                }`}
              >
                <span className="mr-3 shrink-0">
                  <RankBadge n={i + 1} active={i === cur} />
                </span>
                {/* 压在实心主题色底上时用正黑：原来用 --brand-deep（同色系深色），
                    蓝底蓝字几乎糊在一起，对比度太差 */}
                <span
                  title={s.title}
                  className={`min-w-0 truncate whitespace-nowrap text-[0.95rem] font-medium leading-[1.4] ${
                    i === cur ? "text-black" : "text-[var(--c-text)]"
                  } sm:text-[1.05rem]`}
                >
                  {s.title}
                </span>
              </SlideLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
