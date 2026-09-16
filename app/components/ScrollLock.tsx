"use client";

import { useEffect } from "react";

/**
 * 页脚保护：让「文档底边 = 页脚底边」永远成立，滚动条滑到底自然刹停。
 *
 * 背景：只要页脚下方多出哪怕一点高度（图片懒加载位移、内容回缩后浏览器没有重新
 * 夹紧滚动位置、脚本或浏览器扩展后插进来的节点……），页面就会多出一段能滚进去的
 * 空白；如果只在 scroll 事件里把滚动位置硬拽回来，拖动滚动条到底时就会被拽得
 * 来回跳，很晃眼。
 *
 * 所以这里的思路是「先把多出来的高度弄没，而不是跟用户抢滚动位置」，分四层：
 *   1) 清掉多余的节点：找出「整块都在页脚底边之下、又不是被祖先裁掉的」元素——
 *      这种元素在设计里根本不可见，直接移出文档流。每次检查都跑一遍，所以
 *      「加载完之后才插进来的」也能收掉。
 *   2) 清掉页脚自身多出来的下外边距（极端情况下 margin 也会撑出空白）。
 *   3) 还是找不到元凶（例如元素压着页脚、又往下戳出去一截，或者浏览器扩展插进来
 *      的东西），就用 overflow:clip 把「页脚底边之外」的多余高度直接变成
 *      **不可滚动**——这一步完全不动滚动位置，所以不会晃。
 *   4) 最后才兜底夹回（正常布局下 limit === maxScroll，永远不会触发）。
 *
 * 第 3 / 4 层在健康布局下都不会触发，所以拖动滚动条不会被抢位置。
 */
export default function ScrollLock() {
  useEffect(() => {
    let raf = 0;
    let marginsTouched = false;
    let clipped = false;
    let cachedFooter: HTMLElement | null = null;

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };

    // 缓存最后一个 footer，避免每个 scroll 事件都做一次 DOM 查询
    const lastFooter = (): HTMLElement | null => {
      if (cachedFooter && cachedFooter.isConnected) return cachedFooter;
      const all = document.querySelectorAll("footer");
      cachedFooter = all.length ? (all[all.length - 1] as HTMLElement) : null;
      return cachedFooter;
    };

    /** 该元素是否被某个非 visible 溢出的祖先裁掉了（被裁掉就不影响文档高度） */
    const isClipped = (el: Element, body: HTMLElement) => {
      let p: Element | null = el.parentElement;
      // 走到 body 就停：body 自身的 overflow 由 ScrollLock 自己控制，不参与判断
      while (p && p !== body) {
        const ov = getComputedStyle(p);
        if (ov.overflowX !== "visible" || ov.overflowY !== "visible") return true;
        p = p.parentElement;
      }
      return false;
    };

    /** 收掉「整块落在页脚底边之下」的节点，返回收掉的个数 */
    const pruneBelowFooter = (footerBottom: number, sy: number, body: HTMLElement) => {
      let removed = 0;
      // document 顺序遍历：父元素先被判断，父元素被收掉后子元素的 rect 高度为 0，
      // 自然会被跳过，所以不用再单独判断「只处理最外层」。
      for (const el of Array.from(body.querySelectorAll<HTMLElement>("*"))) {
        if (removed >= 5) break;
        if (el.closest("footer")) continue;
        // 站点自己的悬浮 UI（返回顶部 / 主题切换 / 侧边广告）永远不碰
        if (el.hasAttribute("data-xivi-ui") || el.closest("[data-xivi-ui]")) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.position === "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) continue;
        // 整块都在页脚底边之下才算多余；压着页脚上沿的容器不算
        if (r.top + sy < footerBottom - 1) continue;
        if (isClipped(el, body)) continue;
        el.style.display = "none";
        removed++;
      }
      return removed;
    };

    /**
     * 第 3 层：把「页脚底边之外」的多余高度变成不可滚动。
     *
     * 注意 html 的 overflow-x 必须先设成非 visible：否则 body 的 overflow 会被
     * 传播到视口（变成整页不能滚）。设了之后 body 的 clip 只作用于 body 自己，
     * 而 overflow:clip 不会新建滚动容器，所以吸顶头部 / 侧栏 sticky 都照旧。
     */
    const applyClip = () => {
      document.documentElement.style.overflowX = "clip";
      document.body.style.overflow = "clip";
      clipped = true;
    };

    const check = () => {
      raf = 0;
      const footer = lastFooter();
      if (!footer) return;

      const body = document.body;
      const de = document.documentElement;
      const sy = window.scrollY;
      const footerBottom = footer.getBoundingClientRect().bottom + sy;
      // 浏览器算滚动上限用的是 clientHeight，不用 innerHeight（有横向滚动条时差十几 px）
      const viewport = de.clientHeight;
      const maxScroll = Math.max(0, de.scrollHeight - viewport);

      if (de.scrollHeight - footerBottom > 1) {
        // 第 1 层：清掉整块落在页脚底边之下的节点
        if (pruneBelowFooter(footerBottom, sy, body)) {
          schedule();
          return;
        }
        // 第 2 层：页脚自己多出来的下外边距
        if (!marginsTouched) {
          marginsTouched = true;
          footer.style.marginBottom = "0px";
          body.style.paddingBottom = "";
          schedule();
          return;
        }
        // 第 3 层：clip 掉页脚底边之外的多余高度（不动滚动位置，所以不晃）
        if (!clipped) {
          applyClip();
          schedule();
          return;
        }
      }

      // 第 4 层：兜底夹回（正常布局下永远不会触发）
      const limit = Math.max(0, Math.min(maxScroll, footerBottom - viewport));
      if (window.scrollY > limit + 2) {
        window.scrollTo({ top: limit, behavior: "instant" });
      }
    };

    const onScroll = () => {
      // 只在「浏览器把滚动位置留在了越界处」时兜底夹回；健康布局下 limit === maxScroll，
      // 这个比较恒不成立，拖滚动条不会被抢位置。
      const footer = lastFooter();
      if (!footer) return;
      const de = document.documentElement;
      const footerBottom = footer.getBoundingClientRect().bottom + window.scrollY;
      const limit = Math.max(
        0,
        Math.min(de.scrollHeight - de.clientHeight, footerBottom - de.clientHeight)
      );
      if (window.scrollY > limit + 2) {
        window.scrollTo({ top: limit, behavior: "instant" });
      }
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", onScroll, { passive: true });
    // 内容高度变化（懒加载、翻页、公告显隐）后重新检查
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    // 只改变 DOM、既不改 body 尺寸也不改滚动位置的注入（浏览器扩展插节点、
    // React 重渲染补内容）不会触发 resize / scroll，所以再挂一个 MutationObserver
    // 兜住这类情况——否则「戳出去的元素」会一直留着，页脚下方就多出空白。
    // rAF 合帧 + 只在有富余高度时才动 DOM，收敛后不会再触发。
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    check();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
