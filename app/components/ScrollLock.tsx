"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 页脚下限：让「文档底边 = 页脚底边」成为所有页面的硬下限。
 *
 * 需求（2026-09-17 用户明确）：**页脚沉底 + 滚动条沉底**，这两条就是页面的下限，
 * 页脚下方任何尺寸的空白都不允许。等价于一条可断言的不变量：
 *     documentElement.scrollHeight − 页脚底边 ≤ 2px
 *
 * ── 三条浏览器规则（都是实测出来的，别凭直觉改）──────────────────────
 * ① 「可滚动溢出区」按每个盒子的 **border box** 累加，不是 margin box：
 *    `marginBottom: -160px` 只改 margin box —— 父容器高度确实矮了（1419→1259），
 *    但 `scrollHeight` 纹丝不动（1419→1419），那 160px 照样滚得进去。
 * ② 同理，把 **body 自己的 height 收紧也砍不掉子元素溢出的高度**：
 *    实测把 body.height 钉在页脚底边后 bodyH 变成了 7932，`scrollHeight` 仍是 8332。
 *    **这条否掉了「钉 body 高度」这个看起来很美妙的方案。**
 * ③ 于是唯一可靠的杠杆是「**作用在越界元素本身**」，让它的 border box 别再越界：
 *    流内元素用负**上**边距上拉（纯位移，文档总高度不变 → 不会触发夹回、不会跳）；
 *    绝对/固定定位元素负边距无效（位置被 inset 定死），只能 display:none ——
 *    它整块都在页脚底边之下，在设计里本来就不可见，隐藏不损失任何可见内容。
 *
 * ── 被否掉的老办法（都在这里，别再回头）──────────────────────────────
 *   · `overflow: clip`（第一版第 3 层）：依赖「html 的 overflow 非 visible」这条隐蔽前提，
 *     前提一被覆盖（只给 body 设 clip）整页直接不能滚 —— 对照实验里滚到底 y 停在 0、差满量程。✗
 *   · scroll 事件里硬夹回滚动位置（第一版第 4 层）：直接跟用户抢滚动位置，
 *     本身就是「拖到底会跳」「拖不到底」的来源，与需求正面冲突。✗
 *   · 负下边距：见 ①。✗    · 钉 body 高度：见 ②。✗
 *
 * ── 兜底（CSS 层，见 globals.css 的 `html` 规则）──────────────────────
 * 万一遇到「余量来自某个容器自身的 height/min-height、根本没有越界元素」这类
 * 本组件够不着的情况：`html { background-color: var(--c-soft) }` 会让**页脚以下的余量
 * 直接呈现页脚底色**（body 有自己的背景色，画布才轮到 html 上色）。组件先尽力根治，
 * 兜底保证页面上永远不会出现一条刺眼的空白。
 *
 * ── 三条硬约束（改这个文件前逐条确认）────────────────────────────────
 *   ① 绝不碰滚动位置（不 clamp、不 scrollTo）。
 *   ② 除「先把多余高度弄没」以外不做任何裁剪。
 *   ③ 收不动就什么都不做；健康页面（实测全部路由 0.41~0.42px）一个字节都不碰。
 *
 * MutationObserver **刻意不监听 style**：本组件写的就是 style，监听会自我触发成死循环；
 * 只监听 childList + class —— 懒加载补内容、React 重渲染、扩展插节点都能抓到，
 * 而「只改 DOM、既不改 body 尺寸也不改滚动位置」的注入正是靠它才复查得到。
 */

const TOUCHED = "data-xivi-pruned";
/** 单轮最多处理多少个越界元素（防止扩展一次注入大量节点时卡住主线程） */
const MAX_FIX = 12;

export default function ScrollLock() {
  const pathname = usePathname();

  useEffect(() => {
    let raf = 0;
    let cachedFooter: HTMLElement | null = null;

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };

    // 缓存最后一个 footer，避免每次复查都做 DOM 查询
    const lastFooter = (): HTMLElement | null => {
      if (cachedFooter && cachedFooter.isConnected) return cachedFooter;
      const all = document.querySelectorAll("footer");
      cachedFooter = all.length ? (all[all.length - 1] as HTMLElement) : null;
      return cachedFooter;
    };

    /** 该元素是否被某个非 visible 溢出的祖先裁掉了（被裁掉就不影响文档高度） */
    const isClipped = (el: Element, body: HTMLElement) => {
      let p: Element | null = el.parentElement;
      while (p && p !== body) {
        const ov = getComputedStyle(p);
        if (ov.overflowX !== "visible" || ov.overflowY !== "visible") return true;
        p = p.parentElement;
      }
      return false;
    };

    /** 还原本组件做过的所有改动（换路由 / 改窗口大小时先跑，保证每次都是干净重算） */
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

    /**
     * 把「整块落在页脚底边之下」的节点收回文档流，返回处理个数。
     * document 顺序遍历：父元素先被判断，父元素被收掉后子元素的 rect 会归零、
     * 自然被跳过，所以不必再单独挑「最外层那一个」。
     */
    const collapseBelow = (footerBottom: number, sy: number, body: HTMLElement) => {
      let fixed = 0;
      for (const el of Array.from(body.querySelectorAll<HTMLElement>("*"))) {
        if (fixed >= MAX_FIX) break;
        if (el.hasAttribute(TOUCHED)) continue;
        const cs = getComputedStyle(el);
        // fixed 本就不计入文档高度；display:none 的不用管
        if (cs.display === "none" || cs.position === "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) continue;
        // 整块都在页脚底边之下才算多余；压着页脚上沿的容器不算
        const bottom = r.bottom + sy;
        if (bottom <= footerBottom + 1) continue;
        if (isClipped(el, body)) continue;

        if (cs.position === "static" || cs.position === "relative" || cs.position === "sticky") {
          // 流内元素：负**上**边距把它整体上拉，底边正好落到页脚底边上 ——
          // 不改滚动位置、不裁剪、不隐藏内容，且文档总高度不变 → 不会夹回、不会跳
          el.style.marginTop = `-${Math.round(bottom - footerBottom)}px`;
          el.setAttribute(TOUCHED, "margin");
        } else {
          // 绝对定位：负边距对它无效，只能隐藏（整块都在页脚底边之下，本就不可见）
          el.style.display = "none";
          el.setAttribute(TOUCHED, "hidden");
        }
        fixed++;
      }
      return fixed;
    };

    /**
     * 唯一的检查入口。这里**不还原**：还原只发生在换路由与改窗口大小时，
     * 否则会变成「还原 → 又量到余量 → 再收」的来回抖。
     */
    const check = () => {
      raf = 0;
      const footer = lastFooter();
      const body = document.body;
      if (!footer || !body) return;

      const sy = window.scrollY;
      const footerBottom = footer.getBoundingClientRect().bottom + sy;
      const over = document.documentElement.scrollHeight - footerBottom;

      // 健康布局（实测全部路由 0.41~0.42px）走这里直接返回，一个字节都不动
      if (over <= 2) return;

      // 有余量才出手，最多收 MAX_FIX 个；收不动就不硬来，
      // 交给 globals.css 里 html 的页脚底色兜底 —— 宁可留一点同色余量，也绝不碰滚动位置
      if (collapseBelow(footerBottom, sy, body)) schedule();
    };

    const onResize = () => {
      // 窗口尺寸变了，之前算出的负边距/隐藏可能都不再成立：先还原再重算
      restoreAll();
      schedule();
    };

    // 兜底：扩展在页面 onload 之后才注入 DOM、或图片/字体异步加载把某个元素撑高，
    // 这类变化可能不再触发 DOM 变更（节点已存在只是尺寸变了），单靠 MutationObserver 会漏。
    // 因此在 load 完成后、以及挂载后若干个时间点各补一次复查，把残留的越界元素收掉。
    const onLoad = () => schedule();
    const timers = [
      setTimeout(check, 600),
      setTimeout(check, 1500),
      setTimeout(check, 3000),
    ];

    window.addEventListener("resize", onResize);
    window.addEventListener("load", onLoad);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
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
      window.removeEventListener("load", onLoad);
      timers.forEach(clearTimeout);
      ro.disconnect();
      mo.disconnect();
      // 换路由（或卸载）时还原，保证下一个页面从零开始量
      restoreAll();
    };
    // pathname 进依赖：客户端跳转时本 effect 会重跑一次，等于自动「还原 + 重算」
  }, [pathname]);

  return null;
}
