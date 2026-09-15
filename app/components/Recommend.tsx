import Link from "next/link";
import type { PostMeta } from "@/lib/db";

/**
 * 前 3 名用橙红渐变数字，其余浅灰。
 * 字体与尺寸对齐美团 .recommended-list .index：
 * font-family:Georgia,serif; font-size:1.5rem; font-style:italic;
 * font-weight:700; line-height:1; width:24px; margin-right:5px
 */
const TOP_RANK = [
  "text-[#FF4D4F]",
  "text-[#FF7A45]",
  "text-[var(--brand)]",
];

/** 美团 .recommended-card h3 .recommended-icon：15×15 */
function IconFire() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] shrink-0 text-[#FF6B35]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-5.39-2.59-10.2-6.5-13.33zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
    </svg>
  );
}

/** 侧边栏推荐条数上限（与后台推荐名额一致） */
const RECOMMEND_SHOW = 10;

export default function Recommend({ posts }: { posts: PostMeta[] }) {
  if (!posts?.length) return null;
  const items = posts.slice(0, RECOMMEND_SHOW);

  return (
    <div className="rounded-2xl border border-[var(--c-border-2)] p-5">
      {/* 美团 h3：1.1rem / 600 / margin-bottom 1.5rem / padding-bottom .5rem / 1px 分隔线 */}
      <h3 className="mb-6 flex items-center gap-1 border-b border-[var(--c-border-2)] pb-2 text-[1.1rem] font-semibold text-[var(--c-text)]">
        <IconFire />
        推荐阅读
      </h3>

      <ol>
        {items.map((p, i) => (
          <li
            key={p.id}
            className="flex items-start"
            style={{ marginBottom: "1.2rem" }}
          >
            <span
              className={`shrink-0 text-center font-[Georgia,serif] text-[1.5rem] font-bold italic leading-none ${
                i < 3 ? TOP_RANK[i] : "text-[#dcddde]"
              }`}
              style={{ width: "24px", marginRight: "5px" }}
            >
              {i + 1}
            </span>
            <Link
              href={`/blog/${p.slug}`}
              title={p.title}
              className="block truncate text-[1rem] text-[var(--c-text)] transition-colors hover:text-[var(--brand-deep)]"
              style={{ lineHeight: "1.5rem" }}
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
