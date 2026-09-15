/**
 * 封面缩略图：图片 + 左上角纯黑加粗「XIVI」水印（白色微光晕保证深色封面可读）。
 *
 * 全站所有展示封面小图的位置统一用本组件，保证水印的位置与观感一致。
 * 字号用容器查询单位（cqw）随容器宽度自适应，大图自动放大、小图保底可读。
 * 轮播大图不属于缩略图，不套用本组件，避免遮挡标题。
 */
import type { ReactEventHandler } from "react";

type Props = {
  src: string;
  alt?: string;
  /** 容器附加类：尺寸、圆角、外框等 */
  className?: string;
  /** 图片附加类：hover 动效等 */
  imgClassName?: string;
  /** 关闭水印 */
  watermark?: boolean;
  loading?: "lazy" | "eager";
  onError?: ReactEventHandler<HTMLImageElement>;
};

export default function CoverThumb({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  watermark = true,
  loading = "lazy",
  onError,
}: Props) {
  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        onError={onError}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      {watermark && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[7%] top-[7%] select-none font-black leading-none tracking-[-0.02em] text-black [text-shadow:0_1px_3px_rgba(255,255,255,.45)]"
          style={{ fontSize: "clamp(9px, 8.5cqw, 20px)" }}
        >
          XIVI
        </span>
      )}
    </span>
  );
}
