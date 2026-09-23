/**
 * 全站唯一滚动容器（layout.tsx 里 main#xivi-main）的取用入口。
 *
 * 2026-09-17 布局重构后：body 定高一屏 + overflow-hidden，文档级永不滚动，
 * 所有滚动行为（回顶、目录高亮、悬浮按钮停靠、分页回顶）都发生在 main 内部。
 * 各组件统一通过这里拿容器，避免各写各的选择器。
 */
export function getMainScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("xivi-main");
}

/** 监听滚动容器滚动（容器未挂载时退回 window，保证逻辑不中断） */
export function onMainScroll(handler: () => void): () => void {
  handler();
  const el = getMainScroller();
  if (el) {
    el.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      el.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }
  window.addEventListener("scroll", handler, { passive: true });
  window.addEventListener("resize", handler);
  return () => {
    window.removeEventListener("scroll", handler);
    window.removeEventListener("resize", handler);
  };
}

/** 平滑滚回顶部（容器内） */
export function scrollMainToTop(behavior: ScrollBehavior = "smooth") {
  const el = getMainScroller();
  if (el) el.scrollTo({ top: 0, behavior });
  else window.scrollTo({ top: 0, behavior });
}
