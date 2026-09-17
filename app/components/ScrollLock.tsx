"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 页脚保护：保证「文档底边 = 页脚底边」，于是滚动条滑到底时会自然刹停，
 * 页脚底边正好贴住视口底边、下面不留空白。
 *
 * ── 第一版为什么被推翻（2026-09-17）────────────────────────────────
 * 第一版分四层，其中第 3 / 4 层是：`html{overflow-x:clip}` + `body{overflow:clip}`
 * 把页脚底边之外的高度变成不可滚动，再在 scroll 事件里把越界的滚动位置硬夹回来。
 * 实测定出两个问题：
 *   ① 第 3 层依赖一条隐蔽前提 —— 必须先让 html 的 overflow 非 visible，
 *      否则 body 的 overflow 会**传播到视口**。对照实验里只给 body 设 clip、
 *      html 不动时，整页直接不能滚（滚到底 y 停在 0，差满量程）。
 *      这条前提一旦被别处覆盖（主题切换重写 style、扩展改样式），全站就卡死。
 *   ② 第 4 层是直接从用户手里把滚动位置拽回来 —— 这本身就是「拖到底会跳」
 *      和「滚动条拖不到底」的来源，与需求直接冲突。
 * 而且实测 7 条路由 × 5 种视口，「文档底 − 页脚底」全都是 0.4px 左右
 * （连 SSR 原始布局、禁用 JS 也是），说明这两层在真实页面里**从不触发**，
 * 纯负债。所以全部删掉。
 *
 * ── 现在的做法（只剩一件事）──────────────────────────────────────
 * 只在「文档底边确实比页脚底边更低」时才动手，且用**不改滚动位置、不做裁剪**的方式：
 *   · 流内元素伸出页脚底边 → 用负**上**边距把它往上拉到页脚底边（内容不隐藏、不裁剪）；
 *   · 绝对定位元素（负边距管不了它）→ 隐藏它 —— 它整块都在页脚底边之下，
 *     本来就不可能被看到，隐藏不损失任何内容。
 *
 * ⚠️ 为什么是负上边距、不是负下边距（2026-09-17 实测，别再改回去）：
 *   「可滚动溢出区」是按子元素的 **border box** 累加的，负下边距只改 margin box，
 *   所以 `margin-bottom:-160px` 能把父容器高度压小（实测 1419→1259），
 *   但 `documentElement.scrollHeight` **纹丝不动**（1419→1419），那 160px 照样能滚进去。
 *   负上边距是位移：元素 border box 整体上移，底边正好落在页脚底边上，
 *   scrollHeight 保持原值（5843→5843）、页脚下空白归零 —— 且因为总高度没变，
 *   浏览器不会夹回滚动位置，所以不会有任何跳动。
 * 收过的元素会打标记，**每次换路由 / 改窗口大小都先整体还原再重算**，
 * 避免「上一页压住的高度把下一页也压着」。
 * 收不动就什么都不做 —— 宁可留一点空白，也绝不跟用户抢滚动位置，
 * 因为「拖到底不跳、滚动条能拖到底」是硬需求。
 */

const TOUCHED = "data-xivi-pruned";

export default function ScrollLock() {
  const pathname = usePathname();

  useEffect(() => {
    let raf = 0;
    let cachedFooter: HTMLElement | null = null;

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };

    // 缓存最后一个 footer，避免每个检查都做一次 DOM 查询
    const lastFooter = (): HTMLElement | null => {
      if (cachedFooter && cachedFooter.isConnected) return cachedFooter;
      const all = document.querySelectorAll("footer");
      cachedFooter = all.length ? (all[all.length - 1] as HTMLElement) : null;
      return cachedFooter;
    };

    /** 该元素是否被某个非 visible 溢出的祖先裁掉了（被裁掉就不影响文档高度） */
    const isClipped = (el: Element, body: HTMLElement) => {
      let p: Element | null = el.parentElement;
      // 走到 body 就停：body 自身的 overflow 不由本组件改动
      while (p && p !== body) {
        const ov = getComputedStyle(p);
        if (ov.overflowX !== "visible" || ov.overflowY !== "visible") return true;
        p = p.parentElement;
      }
      return false;
    };

    /** 还原本组件做过的所有改动（换路由 / 改窗口大小时先跑一次，保证每次都是干净重算） */
    const restoreAll = () => {
      const body = document.body;
      if (!body) return;
      for (const el of Array.from(body.querySelectorAll<HTMLElement>(`[${TOUCHED}]`))) {
        const kind = el.getAttribute(TOUCHED);
        if (kind === "margin") el.style.marginTop = "";
        else if (kind === "hidden") el.style.display = "";
        el.removeAttribute(TOUCHED);
      }
    };

    /** 把「整块落在页脚底边之下」的节点收回文档流，返回处理个数 */
    const collapseBelow = (footerBottom: number, sy: number, body: HTMLElement) => {
      let fixed = 0;
      // document 顺序遍历：父元素先被判断，父元素被收掉后子元素的 rect 就归零，
      // 自然会被跳过，所以不必再单独判断「只处理最外层」。
      for (const el of Array.from(body.querySelectorAll<HTMLElement>("*"))) {
        if (fixed >= 5) break;
        if (el.closest("footer")) continue;
        // 站点自己的悬浮 UI（返回顶部 / 主题切换 / 侧边广告）永远不碰
        if (el.hasAttribute("data-xivi-ui") || el.closest("[data-xivi-ui]")) continue;
        if (el.hasAttribute(TOUCHED)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.position === "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) continue;
        // 整块都在页脚底边之下才算多余；压着页脚上沿的容器不算
        const bottom = r.bottom + sy;
        if (bottom <= footerBottom + 1) continue;
        if (isClipped(el, body)) continue;

        const excess = bottom - footerBottom;
        if (cs.position === "static" || cs.position === "relative" || cs.position === "sticky") {
          // 流内元素：负**上**边距把它整体上拉，底边落到页脚底边上 ——
          // 不改滚动位置、不裁剪、不隐藏内容，且文档总高度不变（无跳动）。
          el.style.marginTop = `-${Math.round(excess)}px`;
          el.setAttribute(TOUCHED, "margin");
        } else {
          // 绝对定位元素：负边距对它无效（位置已经由 inset 定死），只能隐藏。
          // 它整块都在页脚底边之下，在设计里本来就不可见。
          el.style.display = "none";
          el.setAttribute(TOUCHED, "hidden");
        }
        fixed++;
      }
      return fixed;
    };

    /**
     * 唯一的检查入口。
     * 注意：这里**不还原**（否则「还原 → 又有余量 → 再收」会来回抖）。
     * 还原只发生在换路由和改窗口大小时。
     */
    const check = () => {
      raf = 0;
      const footer = lastFooter();
      if (!footer || !document.body) return;

      const de = document.documentElement;
      const sy = window.scrollY;
      const footerBottom = footer.getBoundingClientRect().bottom + sy;
      const over = de.scrollHeight - footerBottom;

      // 健康布局（实测所有路由都是 0.4px 上下）走这里直接返回，一个字节都不动
      if (over <= 2) return;

      // 有余量才出手，且最多收 5 个；收不动就放弃，绝不去夹滚动位置
      if (collapseBelow(footerBottom, sy, document.body)) schedule();
    };

    const onResize = () => {
      // 窗口尺寸变了，之前算出的负边距/隐藏可能都不再成立：先还原再重算
      restoreAll();
      schedule();
    };

    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    // 只监听「节点增删 + class 变化」：
    //   · 懒加载补内容、React 重渲染插节点 → childList/subtree 能抓到；
    //   · **刻意不监听 style** —— 本组件自己写的就是 style，监听了会自我触发成死循环。
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    check();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      mo.disconnect();
      // 换路由（或卸载）时还原，保证下一个页面从零开始量
      restoreAll();
    };
    // pathname 进依赖：客户端跳转时本 effect 会重跑一次，等于自动「还原 + 重算」
  }, [pathname]);

  return null;
}
