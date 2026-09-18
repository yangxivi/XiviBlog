"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import CoverThumb from "@/app/components/CoverThumb";
import type {
  CarouselConfig,
  CarouselSlide,
  FooterColumn,
  LatestCommentsConfig,
  LinkItem,
  PromoCard,
  QrItem,
  SiteSettings,
} from "@/lib/settings";
import { compressImage } from "../image-utils";
import FriendCheckPanel from "./friend-check";
import { THEMES } from "@/lib/themes";
import { MEMORIAL_DAYS, MEMORIAL_THEME_ID, memorialToday, nextMemorial, invalidMemorialLines, type MemorialDay } from "@/lib/memorial";

export type PostOption = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string;
  tag: string;
};

/* 表单控件基础样式（不含宽度）。
   注意：w-full 与 w-36/w-40 这类固定宽度不能同时用在一个元素上 ——
   两者冲突时 w-full 可能胜出，再叠加 shrink-0 会让元素锁死 100% 宽且不可收缩，
   在 flex 行里会把整页横向撑爆（表现为页面右侧大片空白）。固定宽度场景请用 FIELD。 */
const FIELD =
  "min-w-0 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--brand)]";
const INPUT = `w-full ${FIELD}`;
const LABEL = "mb-1 block text-xs font-medium text-[var(--c-text-3)]";
const BTN_GHOST =
  "rounded-lg border border-[var(--c-border-3)] px-2.5 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";
const CARD =
  "rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-5";
const TITLE = "text-sm font-semibold text-[var(--c-text)]";

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export default function SettingsForm({
  initial,
  postOptions,
}: {
  initial: SiteSettings;
  postOptions: PostOption[];
}) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  /* ---------------- 国家公祭日 ---------------- */
  // 今日是否命中纪念日。放在 effect 里算而不是渲染期直接算：服务端与浏览器
  // 时区可能不同，渲染期计算容易出现水合文本不一致；放在 effect 里还能随
  // 自定义日期输入实时刷新。
  const [todayMemorial, setTodayMemorial] = useState<MemorialDay | null>(null);
  // 今天 / 明天 / 后天的自检结果，方便站长确认自定义日期表有没有写对。
  const [upcoming, setUpcoming] = useState<
    { label: string; day: MemorialDay | null }[]
  >([]);
  // 距今天最近的下一个纪念日（含今天），用于「还有几天」提示。
  const [nextDay, setNextDay] = useState<{
    day: MemorialDay;
    inDays: number;
  } | null>(null);
  // 自定义日期表里解析不了的条目，用于标红提示（避免静默丢弃）。
  const [invalidLines, setInvalidLines] = useState<string[]>([]);
  // 「整站素灰」本地预览开关：临时给 <html> 套上纪念灰 + data-memorial，
  // 纯客户端、可逆，只影响本机浏览器，不影响线上访客。
  const [previewing, setPreviewing] = useState(false);
  const previewSaved = useRef<{
    theme: string | null;
    memorial: string | null;
  } | null>(null);

  useEffect(() => {
    setTodayMemorial(memorialToday(s.memorialDays));
    setUpcoming([
      { label: "今天", day: memorialToday(s.memorialDays, 0) },
      { label: "明天", day: memorialToday(s.memorialDays, -1) },
      { label: "后天", day: memorialToday(s.memorialDays, -2) },
    ]);
    setNextDay(nextMemorial(s.memorialDays));
    setInvalidLines(invalidMemorialLines(s.memorialDays));
  }, [s.memorialDays]);

  // 离开本页时务必还原，避免预览的素灰状态残留到其它页面。
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      if (!previewSaved.current) return;
      if (previewSaved.current.theme)
        root.setAttribute("data-theme", previewSaved.current.theme);
      if (previewSaved.current.memorial)
        root.setAttribute("data-memorial", previewSaved.current.memorial);
      else root.removeAttribute("data-memorial");
    };
  }, []);

  const toggleMemorialPreview = () => {
    const root = document.documentElement;
    if (!previewing) {
      previewSaved.current = {
        theme: root.getAttribute("data-theme"),
        memorial: root.getAttribute("data-memorial"),
      };
      root.setAttribute("data-theme", MEMORIAL_THEME_ID);
      root.setAttribute("data-memorial", "1");
      setPreviewing(true);
    } else {
      if (previewSaved.current) {
        if (previewSaved.current.theme)
          root.setAttribute("data-theme", previewSaved.current.theme);
        if (previewSaved.current.memorial)
          root.setAttribute("data-memorial", previewSaved.current.memorial);
        else root.removeAttribute("data-memorial");
      }
      setPreviewing(false);
    }
  };

  /* ---------------- 首页轮播 ---------------- */
  const car = s.carousel;
  const patchCar = (p: Partial<CarouselConfig>) =>
    set("carousel", { ...car, ...p });
  const patchSlide = (i: number, p: Partial<CarouselSlide>) =>
    patchCar({
      slides: car.slides.map((sl, idx) => (idx === i ? { ...sl, ...p } : sl)),
    });

  const slideFileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef(-1);
  const onSlideFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const i = uploadTarget.current;
    if (!f || i < 0) return;
    try {
      const dataUrl = await compressImage(f, 1200, 0.82);
      patchSlide(i, { image: dataUrl });
      setMsg({ type: "ok", text: "轮播图已上传并压缩" });
    } catch {
      setMsg({ type: "err", text: "图片读取失败" });
    } finally {
      if (slideFileRef.current) slideFileRef.current.value = "";
      uploadTarget.current = -1;
    }
  };

  const slugOf = (href: string) =>
    href.startsWith("/blog/") ? href.slice("/blog/".length) : "";

  const onPickArticle = (i: number, slug: string) => {
    const p = postOptions.find((x) => x.slug === slug);
    if (!p) return;
    patchSlide(i, {
      title: p.title,
      excerpt: p.excerpt,
      badge: p.tag,
      image: p.cover_image,
      href: `/blog/${p.slug}`,
    });
  };

  /* ---------------- 侧边栏橱窗 ---------------- */
  const patchPromo = (i: number, p: Partial<PromoCard>) =>
    set(
      "promos",
      s.promos.map((c, idx) => (idx === i ? { ...c, ...p } : c))
    );

  const promoFileRef = useRef<HTMLInputElement>(null);
  const promoUploadTarget = useRef(-1);
  const onPromoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const i = promoUploadTarget.current;
    if (!f || i < 0) return;
    try {
      // 橱窗图前台只以 92px 高展示，640px WebP 足够清晰，
      // 同时把内嵌 base64 控制在小几十 KB，避免设置项膨胀拖慢全站页面
      const dataUrl = await compressImage(f, 640, 0.75, undefined, "image/webp");
      patchPromo(i, { image: dataUrl });
      setMsg({ type: "ok", text: "橱窗图片已上传并压缩" });
    } catch {
      setMsg({ type: "err", text: "图片读取失败" });
    } finally {
      if (promoFileRef.current) promoFileRef.current.value = "";
      promoUploadTarget.current = -1;
    }
  };

  /* ---------------- 最新评论模块 ---------------- */
  const lc = s.latestComments;
  const patchLC = (p: Partial<LatestCommentsConfig>) =>
    set("latestComments", { ...lc, ...p });

  /* ---------------- 页脚二维码模块 ---------------- */
  const patchQr = (i: number, p: Partial<QrItem>) =>
    set(
      "footerQr",
      s.footerQr.map((q, idx) => (idx === i ? { ...q, ...p } : q))
    );

  const qrFileRef = useRef<HTMLInputElement>(null);
  const qrUploadTarget = useRef(-1);
  const onQrFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const i = qrUploadTarget.current;
    if (!f || i < 0) return;
    try {
      const dataUrl = await compressImage(f, 640, 0.8, undefined, "image/webp");
      patchQr(i, { image: dataUrl });
      setMsg({ type: "ok", text: "二维码已上传并压缩" });
    } catch {
      setMsg({ type: "err", text: "图片读取失败" });
    } finally {
      if (qrFileRef.current) qrFileRef.current.value = "";
      qrUploadTarget.current = -1;
    }
  };

  /* ---------------- 顶部导航 ---------------- */
  const patchNav = (i: number, p: Partial<LinkItem>) =>
    set(
      "nav",
      s.nav.map((it, idx) => (idx === i ? { ...it, ...p } : it))
    );

  /* ---------------- 页脚分组 ---------------- */
  const patchCol = (ci: number, p: Partial<FooterColumn>) =>
    set(
      "footerColumns",
      s.footerColumns.map((c, idx) => (idx === ci ? { ...c, ...p } : c))
    );
  const patchColLink = (ci: number, li: number, p: Partial<LinkItem>) =>
    set(
      "footerColumns",
      s.footerColumns.map((c, idx) =>
        idx === ci
          ? {
              ...c,
              links: c.links.map((l, j) => (j === li ? { ...l, ...p } : l)),
            }
          : c
      )
    );

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        settings?: SiteSettings;
        error?: string;
      };
      if (res.status === 401) {
        throw new Error("登录已过期，请重新登录后再保存（当前编辑内容未丢失）");
      }
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (j.settings) {
        setS(j.settings);
        // 立即把新主题套用到当前页面：无需等待整页重载即可看到配色变化，
        // 解决「后台切主题刷新看不到、必须关浏览器重开」的体感问题
        if (j.settings.theme) {
          document.documentElement.setAttribute("data-theme", j.settings.theme);
        }
      }
      setMsg({ type: "ok", text: "已保存，正在刷新预览新主题…" });
      // 强制整页刷新：后台所有模块（导航/页脚/配色 CSS 变量）都按新设置重新渲染。
      // 配合 lib/settings.ts 去掉 isolate 内存缓存后，刷新必定拿到最新主题。
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 站点信息 */}
      <section className={CARD}>
        <h2 className={TITLE}>站点信息</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>站点名称</label>
            <input
              className={INPUT}
              value={s.siteName}
              onChange={(e) => set("siteName", e.target.value)}
              placeholder="曦微博客系统 XiviBlogSystem"
            />
          </div>
          <div>
            <label className={LABEL}>LOGO 文字（1-2 字符）</label>
            <input
              className={INPUT}
              value={s.logoText}
              onChange={(e) => set("logoText", e.target.value)}
              placeholder="曦微"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>站点描述</label>
            <textarea
              className={`${INPUT} min-h-[64px] resize-y`}
              value={s.siteDesc}
              onChange={(e) => set("siteDesc", e.target.value)}
              placeholder="一句话介绍站点，用于 SEO 与分享卡片"
            />
          </div>
        </div>
      </section>

      {/* 站点主题 */}
      <section className={CARD}>
        <h2 className={TITLE}>站点主题</h2>
        <p className="mt-1 text-xs text-[var(--c-text-3)]">
          选择全站品牌色方案，保存后所有访客立即生效（不影响各自的明暗偏好）。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {THEMES.map((t) => {
            const active = (s.theme || "meituan") === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set("theme", t.id)}
                className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-[var(--brand)] bg-[var(--c-brand-soft)] shadow-sm"
                    : "border-[var(--c-border-3)] hover:border-[var(--brand)]"
                }`}
              >
                <span
                  className="flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: t.brand, color: t.ink }}
                >
                  {t.name}
                </span>
                <span className="text-xs font-medium text-[var(--c-text-2)]">
                  {t.name}
                </span>
                <span className="text-[11px] leading-tight text-[var(--c-text-3)]">
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 国家公祭日 */}
      <section className={CARD}>
        <h2 className={TITLE}>国家公祭日</h2>
        <p className="mt-1 text-xs text-[var(--c-text-3)]">
          命中纪念日当天，整站自动切换为「纪念灰」并整体去色（连封面图一起变灰），
          覆盖上方选定的主题。日期按北京时间（东八区）判定，跨过零点即生效。
        </p>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand)]"
            checked={s.memorialAuto}
            onChange={(e) => set("memorialAuto", e.target.checked)}
          />
          <span className="text-sm text-[var(--c-text-2)]">
            开启纪念日自动素灰
          </span>
        </label>

        {/* 今日状态：一眼看出今天会不会素灰 */}
        <div className="mt-3 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-xs">
          {!s.memorialAuto ? (
            <span className="text-[var(--c-text-3)]">
              已关闭，不会自动素灰（仍可手动选择「纪念灰」主题）
            </span>
          ) : todayMemorial ? (
            <span className="font-medium text-[var(--c-text)]">
              今天是「{todayMemorial.name}」，整站正在素灰。
            </span>
          ) : (
            <span className="text-[var(--c-text-3)]">
              今天不是纪念日，站点按上方选定的主题显示。
            </span>
          )}
        </div>

        <div className="mt-4">
          <label className={LABEL}>
            自定义纪念日（留空则使用内置日期表）
          </label>
          <textarea
            className={`${INPUT} min-h-[92px] resize-y font-mono`}
            value={s.memorialDays}
            onChange={(e) => set("memorialDays", e.target.value)}
            placeholder={
              "每行一项，格式 MM-DD 或 MM-DD 名称，例如：\n09-18 九一八事变纪念日\n12-13 南京大屠杀死难者国家公祭日"
            }
          />
          {invalidLines.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-red-500">
              无法识别的条目（已忽略）：{invalidLines.join("、")}。请用「MM-DD」或
              「MM-DD 名称」格式，分隔符可用换行 / 逗号 / 分号。
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-[var(--c-text-3)]">
            填了内容会<strong className="font-medium">整体替换</strong>
            内置表（不是追加）。当前内置：
            {MEMORIAL_DAYS.map((d) => `${d.md} ${d.name}`).join("、")}
          </p>
        </div>

        {/* 页脚提醒提前量：控制前台页脚那行小字从几天前开始出现 */}
        <div className="mt-4">
          <label className={LABEL}>页脚提醒提前量（天，0-60）</label>
          <input
            type="number"
            min={0}
            max={60}
            className={INPUT}
            value={s.memorialLeadDays}
            onChange={(e) => set("memorialLeadDays", Number(e.target.value))}
          />
          <p className="mt-2 text-xs leading-relaxed text-[var(--c-text-3)]">
            距离最近一个纪念日 ≤ 该天数时，页脚底部会多出一行小字提醒（今天 / 明天 /
            还有 N 天）；设为 0 则只在纪念日当天提醒。
          </p>
          {nextDay && (
            <p className="mt-1 text-xs leading-relaxed">
              {!s.memorialAuto ? (
                <span className="text-[var(--c-text-3)]">
                  已关闭自动素灰，页脚不会显示提醒。
                </span>
              ) : nextDay.inDays <= s.memorialLeadDays ? (
                <span className="font-medium text-[var(--c-text)]">
                  按当前设置，页脚提醒正在显示（
                  {nextDay.inDays === 0 ? "今天" : `还有 ${nextDay.inDays} 天`}）。
                </span>
              ) : (
                <span className="text-[var(--c-text-3)]">
                  按当前设置，页脚提醒暂不显示；还差{" "}
                  {nextDay.inDays - s.memorialLeadDays} 天进入提醒区间。
                </span>
              )}
            </p>
          )}
        </div>

        {/* 自检 + 预览：不用等到公祭日当天，也能确认日期表与素灰效果 */}
        <div className="mt-4 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="text-[var(--c-text-3)]">日期自检</span>
            {upcoming.map(({ label, day }) => (
              <span key={label} className="text-[var(--c-text-3)]">
                {label}
                <span
                  className={
                    day
                      ? "ml-1 font-medium text-[var(--c-text)]"
                      : "ml-1 text-[var(--c-text-4)]"
                  }
                >
                  {day ? day.name : "非纪念日"}
                </span>
              </span>
            ))}
          </div>
          {nextDay && (
            <div className="mt-2 text-xs text-[var(--c-text-3)]">
              下一个公祭日
              <span className="ml-1 font-medium text-[var(--c-text)]">
                {nextDay.day.md} {nextDay.day.name}
              </span>
              <span className="ml-1">
                （{nextDay.inDays === 0 ? "就是今天" : `还有 ${nextDay.inDays} 天`}）
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleMemorialPreview}
            className={`${BTN_GHOST} mt-3`}
          >
            {previewing ? "退出素灰预览" : "预览整站素灰效果"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-[var(--c-text-4)]">
            点「预览」会临时给当前页面套上「纪念灰 + 整站去色」，方便确认效果；
            仅本机浏览器可见，不影响线上访客，再点一次退出。
          </p>
        </div>
      </section>

      {/* 顶部导航 */}
      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={TITLE}>顶部导航</h2>
          <button
            className={BTN_GHOST}
            onClick={() => set("nav", [...s.nav, { label: "新链接", href: "/" }])}
          >
            + 添加导航项
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--c-text-3)]">
          站内链接以 / 开头，站外写完整地址（https://…），站外链接会在新窗口打开。
        </p>
        <div className="mt-4 space-y-2">
          {s.nav.map((n, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${FIELD} w-40 shrink-0`}
                value={n.label}
                onChange={(e) => patchNav(i, { label: e.target.value })}
                placeholder="名称"
              />
              <input
                className={INPUT}
                value={n.href}
                onChange={(e) => patchNav(i, { href: e.target.value })}
                placeholder="/history 或 https://…"
              />
              <button
                className={BTN_GHOST}
                disabled={i === 0}
                onClick={() => set("nav", move(s.nav, i, -1))}
                title="上移"
              >
                ↑
              </button>
              <button
                className={BTN_GHOST}
                disabled={i === s.nav.length - 1}
                onClick={() => set("nav", move(s.nav, i, 1))}
                title="下移"
              >
                ↓
              </button>
              <button
                className={BTN_GHOST}
                onClick={() => set("nav", s.nav.filter((_, x) => x !== i))}
                title="删除"
              >
                删除
              </button>
            </div>
          ))}
          {s.nav.length === 0 && (
            <p className="text-xs text-[var(--c-text-3)]">暂无导航项</p>
          )}
        </div>
      </section>

      {/* 首页轮播 */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={TITLE}>首页轮播</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => patchCar({ mode: "auto" })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                car.mode === "auto"
                  ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                  : "border border-[var(--c-border-3)] text-[var(--c-text-2)] hover:border-[var(--brand)]"
              }`}
            >
              自动取最新文章
            </button>
            <button
              type="button"
              onClick={() => patchCar({ mode: "custom" })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                car.mode === "custom"
                  ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                  : "border border-[var(--c-border-3)] text-[var(--c-text-2)] hover:border-[var(--brand)]"
              }`}
            >
              自定义轮播
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>自动切换间隔（秒，2-30）</label>
            <input
              type="number"
              min={2}
              max={30}
              className={INPUT}
              value={car.interval}
              onChange={(e) => patchCar({ interval: Number(e.target.value) })}
            />
          </div>
          {car.mode === "auto" && (
            <div>
              <label className={LABEL}>显示条数（1-10）</label>
              <input
                type="number"
                min={1}
                max={10}
                className={INPUT}
                value={car.count}
                onChange={(e) => patchCar({ count: Number(e.target.value) })}
              />
            </div>
          )}
        </div>

        {car.mode === "auto" ? (
          <p className="mt-3 text-xs text-[var(--c-text-3)]">
            自动取最新发布的 {car.count}{" "}
            篇文章作为轮播，使用文章自身的封面图、标题、摘要与链接。
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-[var(--c-text-3)]">
              每张可「从现有文章中调用」自动填充，也可单独自定义图片、标题与跳转链接。
            </p>

            <input
              ref={slideFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onSlideFile}
            />

            {car.slides.map((sl, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[var(--c-text-3)]">
                    第 {i + 1} 张
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      className={BTN_GHOST}
                      disabled={i === 0}
                      onClick={() =>
                        patchCar({ slides: move(car.slides, i, -1) })
                      }
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      className={BTN_GHOST}
                      disabled={i === car.slides.length - 1}
                      onClick={() => patchCar({ slides: move(car.slides, i, 1) })}
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      className={BTN_GHOST}
                      onClick={() =>
                        patchCar({
                          slides: car.slides.filter((_, x) => x !== i),
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex gap-4">
                  <div className="shrink-0">
                    {sl.image ? (
                      <CoverThumb
                        src={sl.image}
                        className="h-[68px] w-[120px] rounded-lg ring-1 ring-[var(--c-border-2)]"
                      />
                    ) : (
                      <div className="flex h-[68px] w-[120px] items-center justify-center rounded-lg bg-[var(--c-soft)] text-xs text-[var(--c-text-4)]">
                        无图（渐变占位）
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <select
                      className={INPUT}
                      value={slugOf(sl.href)}
                      onChange={(e) => onPickArticle(i, e.target.value)}
                    >
                      <option value="">从现有文章中选择（自动填充）…</option>
                      {postOptions.map((p) => (
                        <option key={p.id} value={p.slug}>
                          {p.title}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className={INPUT}
                        value={sl.image.startsWith("data:") ? "" : sl.image}
                        onChange={(e) => patchSlide(i, { image: e.target.value })}
                        placeholder="图片地址，或点右侧上传本地图片"
                      />
                      <button
                        type="button"
                        className={`${BTN_GHOST} shrink-0`}
                        onClick={() => {
                          uploadTarget.current = i;
                          slideFileRef.current?.click();
                        }}
                      >
                        上传
                      </button>
                    </div>

                    <input
                      className={INPUT}
                      value={sl.title}
                      onChange={(e) => patchSlide(i, { title: e.target.value })}
                      placeholder="轮播标题"
                    />

                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className={INPUT}
                        value={sl.badge}
                        onChange={(e) => patchSlide(i, { badge: e.target.value })}
                        placeholder="角标（可空，如 AI工具）"
                      />
                      <input
                        className={INPUT}
                        value={sl.href}
                        onChange={(e) => patchSlide(i, { href: e.target.value })}
                        placeholder="跳转链接，如 /blog/xxx 或 https://…"
                      />
                    </div>

                    <input
                      className={INPUT}
                      value={sl.excerpt}
                      onChange={(e) => patchSlide(i, { excerpt: e.target.value })}
                      placeholder="副标题/摘要（可空）"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              className={BTN_GHOST}
              onClick={() =>
                patchCar({
                  slides: [
                    ...car.slides,
                    {
                      title: "新轮播项",
                      excerpt: "",
                      badge: "",
                      image: "",
                      href: "/",
                    },
                  ],
                })
              }
            >
              + 添加轮播项
            </button>
          </div>
        )}
      </section>

      {/* 侧边栏橱窗 */}
      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={TITLE}>侧边栏橱窗</h2>
          <button
            className={BTN_GHOST}
            disabled={s.promos.length >= 6}
            onClick={() =>
              set("promos", [
                ...s.promos,
                {
                  variant: "outline",
                  badge: "",
                  title: "新橱窗标题",
                  subtitle: "",
                  image: "",
                  href: "/",
                },
              ])
            }
          >
            + 添加橱窗卡
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--c-text-3)]">
          显示在首页右侧栏顶部，最多 6 张。标题可空（只放图也行，纯图片橱窗卡是合规场景）；标题里换行会按行渲染；图片可上传（自动压缩内嵌）或填外链地址，留空则显示纯色卡。
        </p>

        <input
          ref={promoFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPromoFile}
        />

        <div className="mt-4 space-y-3">
          {s.promos.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--c-border-3)] bg-[var(--c-card)] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--c-text-3)]">
                  #{i + 1}
                </span>
                <input
                  className={`${FIELD} w-40 shrink-0`}
                  value={c.badge}
                  onChange={(e) => patchPromo(i, { badge: e.target.value })}
                  placeholder="角标（可空）"
                />
                <select
                  className={`${FIELD} w-36 shrink-0`}
                  value={c.variant}
                  onChange={(e) =>
                    patchPromo(i, {
                      variant: e.target.value as PromoCard["variant"],
                    })
                  }
                >
                  <option value="outline">白底描边</option>
                  <option value="plain">白底描边·无LOGO</option>
                  <option value="brand">品牌色渐变</option>
                  <option value="dark">深色</option>
                  <option value="meituan">美团黄</option>
                  <option value="wechat">微信绿</option>
                  <option value="zhihu">知乎蓝</option>
                  <option value="tencent">腾讯蓝</option>
                  <option value="xiaohongshu">小红书粉</option>
                  <option value="purple">优雅紫</option>
                  <option value="cyan">青柠绿</option>
                </select>
                <input
                  className={INPUT}
                  value={c.href}
                  onChange={(e) => patchPromo(i, { href: e.target.value })}
                  placeholder="/ 站内路径 或 https://…"
                />
                <button
                  className={BTN_GHOST}
                  disabled={i === 0}
                  onClick={() => set("promos", move(s.promos, i, -1))}
                  title="上移"
                >
                  ↑
                </button>
                <button
                  className={BTN_GHOST}
                  disabled={i === s.promos.length - 1}
                  onClick={() => set("promos", move(s.promos, i, 1))}
                  title="下移"
                >
                  ↓
                </button>
                <button
                  className={`${BTN_GHOST} text-red-500`}
                  onClick={() =>
                    set(
                      "promos",
                      s.promos.filter((_, idx) => idx !== i)
                    )
                  }
                  title="删除"
                >
                  删除
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>主标题（可用换行分段）</label>
                  <textarea
                    className={`${INPUT} min-h-[64px] resize-y`}
                    value={c.title}
                    onChange={(e) => patchPromo(i, { title: e.target.value })}
                    placeholder={"CODE A BETTER LIFE\n曦微博客系统 · 技术笔记"}
                  />
                </div>
                <div>
                  <label className={LABEL}>副标题</label>
                  <textarea
                    className={`${INPUT} min-h-[64px] resize-y`}
                    value={c.subtitle}
                    onChange={(e) => patchPromo(i, { subtitle: e.target.value })}
                    placeholder="副说明（可空）"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-start gap-3">
                <div className="flex-1">
                  <label className={LABEL}>图片地址（可空）</label>
                  <input
                    className={INPUT}
                    value={c.image}
                    onChange={(e) => patchPromo(i, { image: e.target.value })}
                    placeholder="https://… 或上传"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      className={BTN_GHOST}
                      onClick={() => {
                        promoUploadTarget.current = i;
                        promoFileRef.current?.click();
                      }}
                    >
                      上传图片
                    </button>
                    {c.image && (
                      <button
                        className={BTN_GHOST}
                        onClick={() => patchPromo(i, { image: "" })}
                      >
                        清除图片
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-[68px] w-[100px] shrink-0 overflow-hidden rounded-lg border border-[var(--c-border-3)] bg-[var(--c-soft)]">
                  {c.image ? (
                    <CoverThumb src={c.image} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--c-text-4)]">
                      纯色卡
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {s.promos.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--c-border-3)] py-6 text-center text-xs text-[var(--c-text-4)]">
              暂无橱窗卡，点击右上角「添加橱窗卡」新增。
            </p>
          )}
        </div>
      </section>

      {/* 最新评论模块 */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={TITLE}>最新评论</h2>
          <label className="flex items-center gap-2 text-xs text-[var(--c-text-2)]">
            <input
              type="checkbox"
              checked={lc.enabled}
              onChange={(e) => patchLC({ enabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            在侧边栏显示「最新评论」
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--c-text-4)]">
          展示全站最新留言，出现在「推荐阅读」下方。没有留言时该模块自动隐藏。
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>模块标题</label>
            <input
              className={INPUT}
              maxLength={30}
              value={lc.title}
              onChange={(e) => patchLC({ title: e.target.value })}
              placeholder="最新评论"
            />
          </div>
          <div>
            <label className={LABEL}>显示条数（3-10）</label>
            <select
              className={`${INPUT}`}
              value={String(lc.count)}
              onChange={(e) => patchLC({ count: Number(e.target.value) })}
            >
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>评论摘要字数（30-120）</label>
            <input
              type="number"
              min={30}
              max={120}
              className={INPUT}
              value={lc.excerpt}
              onChange={(e) => patchLC({ excerpt: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-xs text-[var(--c-text-2)]">
              <input
                type="checkbox"
                checked={lc.showAvatar}
                onChange={(e) => patchLC({ showAvatar: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              显示头像
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--c-text-2)]">
              <input
                type="checkbox"
                checked={lc.showPost}
                onChange={(e) => patchLC({ showPost: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              显示来源文章
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--c-text-2)]">
              <input
                type="checkbox"
                checked={lc.showTime}
                onChange={(e) => patchLC({ showTime: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              显示时间
            </label>
          </div>
        </div>

        {!lc.enabled && (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--c-border-3)] px-3 py-2 text-xs text-[var(--c-text-4)]">
            当前已关闭，前台侧边栏不会显示该模块。
          </p>
        )}
      </section>

      {/* 页脚品牌区 */}
      <section className={CARD}>
        <h2 className={TITLE}>页脚 · 品牌区</h2>
        <div className="mt-4">
          <label className={LABEL}>品牌描述</label>
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={s.footerBrand}
            onChange={(e) => set("footerBrand", e.target.value)}
            placeholder="记录 AI 应用、Windows 工具与自动化脚本的实践过程。"
          />
        {/* 页脚二维码模块：最多 2 张，可上传或填外链，带标题 */}
        <div className="mt-5 border-t border-[var(--c-border-2)] pt-4">
          <div className="flex items-center justify-between">
            <label className={LABEL + " mb-0"}>页脚二维码（最多 2 张）</label>
            <span className="text-xs text-[var(--c-text-4)]">放公众号 / 客服 / 社群二维码</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {s.footerQr.map((q, qi) => (
              <div
                key={qi}
                className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)]">
                    {q.image ? (
                      <img
                        src={q.image}
                        alt={q.title || "二维码"}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs text-[var(--c-text-4)]">
                        无图
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className={BTN_GHOST}
                      onClick={() => {
                        qrUploadTarget.current = qi;
                        qrFileRef.current?.click();
                      }}
                    >
                      上传图片
                    </button>
                    {q.image && (
                      <button
                        type="button"
                        className="ml-2 text-xs text-[var(--c-text-4)] underline"
                        onClick={() => patchQr(qi, { image: "" })}
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
                <input
                  className={INPUT + " mt-2"}
                  value={q.image.startsWith("data:") ? "" : q.image}
                  onChange={(e) => patchQr(qi, { image: e.target.value })}
                  placeholder="图片地址，或点左侧上传本地图片"
                />
                <input
                  className={INPUT + " mt-2"}
                  value={q.title}
                  onChange={(e) => patchQr(qi, { title: e.target.value })}
                  placeholder="二维码标题，如「公众号」「加微信」"
                  maxLength={40}
                />
              </div>
            ))}
          </div>
          <input
            ref={qrFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onQrFile}
          />
        </div>
        </div>
      </section>

      {/* 页脚链接分组 */}
      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={TITLE}>页脚 · 链接分组</h2>
          <button
            className={BTN_GHOST}
            disabled={s.footerColumns.length >= 4}
            onClick={() =>
              set("footerColumns", [
                ...s.footerColumns,
                { title: "新分组", links: [{ label: "新链接", href: "/" }] },
              ])
            }
          >
            + 添加分组（最多 4 组）
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {s.footerColumns.map((col, ci) => (
            <div
              key={ci}
              className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${FIELD} w-48`}
                  value={col.title}
                  onChange={(e) => patchCol(ci, { title: e.target.value })}
                  placeholder="分组标题"
                />
                <button
                  className={BTN_GHOST}
                  onClick={() =>
                    set("footerColumns", move(s.footerColumns, ci, -1))
                  }
                  disabled={ci === 0}
                  title="上移"
                >
                  ↑
                </button>
                <button
                  className={BTN_GHOST}
                  onClick={() =>
                    set("footerColumns", move(s.footerColumns, ci, 1))
                  }
                  disabled={ci === s.footerColumns.length - 1}
                  title="下移"
                >
                  ↓
                </button>
                <button
                  className={BTN_GHOST}
                  onClick={() =>
                    set(
                      "footerColumns",
                      s.footerColumns.filter((_, x) => x !== ci)
                    )
                  }
                >
                  删除分组
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {col.links.map((l, li) => (
                  <div key={li} className="flex flex-wrap items-center gap-2">
                    <input
                      className={`${FIELD} w-40 shrink-0`}
                      value={l.label}
                      onChange={(e) =>
                        patchColLink(ci, li, { label: e.target.value })
                      }
                      placeholder="名称"
                    />
                    <input
                      className={INPUT}
                      value={l.href}
                      onChange={(e) =>
                        patchColLink(ci, li, { href: e.target.value })
                      }
                      placeholder="/about 或 https://…"
                    />
                    <button
                      className={BTN_GHOST}
                      disabled={li === 0}
                      onClick={() =>
                        patchCol(ci, { links: move(col.links, li, -1) })
                      }
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      className={BTN_GHOST}
                      disabled={li === col.links.length - 1}
                      onClick={() =>
                        patchCol(ci, { links: move(col.links, li, 1) })
                      }
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      className={BTN_GHOST}
                      onClick={() =>
                        patchCol(ci, {
                          links: col.links.filter((_, x) => x !== li),
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}
                <button
                  className={BTN_GHOST}
                  onClick={() =>
                    patchCol(ci, {
                      links: [...col.links, { label: "新链接", href: "/" }],
                    })
                  }
                >
                  + 添加链接
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 全站公告条 */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={TITLE}>全站公告条</h2>
          <label className="flex items-center gap-2 text-xs text-[var(--c-text-2)]">
            <input
              type="checkbox"
              checked={s.notice.enabled}
              onChange={(e) =>
                set("notice", { ...s.notice, enabled: e.target.checked })
              }
              className="h-4 w-4 accent-[var(--brand)]"
            />
            开启（显示在页头下方，访客可关闭）
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>公告文案（留空则不显示）</label>
            <input
              className={INPUT}
              maxLength={120}
              value={s.notice.text}
              onChange={(e) => set("notice", { ...s.notice, text: e.target.value })}
              placeholder="如：站点已迁移至新域名，欢迎收藏"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>点击跳转（可留空，留空则不可点）</label>
            <input
              className={INPUT}
              value={s.notice.href}
              onChange={(e) => set("notice", { ...s.notice, href: e.target.value })}
              placeholder="https:// 开头或站内路径，如 /about"
            />
          </div>
        </div>

        {s.notice.enabled && s.notice.text && (
          <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-[var(--c-border-3)]">
            {/* 这里画的是静态预览，不用真组件（真组件会读 sessionStorage 的关闭状态） */}
            <div className="border-b border-[var(--c-brand-border)] bg-[var(--c-brand-tint)] px-4 py-2 text-sm text-[var(--brand-deep)]">
              <span className="font-semibold">公告</span> {s.notice.text}
              {s.notice.href && <span className="ml-1">→</span>}
            </div>
          </div>
        )}
      </section>

      {/* 友情链接 */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={TITLE}>友情链接</h2>
          <button
            className={BTN_GHOST}
            disabled={s.friends.length >= 24}
            onClick={() =>
              set("friends", [...s.friends, { name: "", href: "", desc: "" }])
            }
          >
            + 添加友链
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--c-text-4)]">
          显示在页脚「友情链接」一栏，最多 24 条。名称与地址都填了才会展示。
        </p>

        <div className="mt-4 space-y-3">
          {s.friends.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 shrink-0 text-xs text-[var(--c-text-4)]">
                  {i + 1}
                </span>
                <input
                  className={`${FIELD} w-40 shrink-0`}
                  value={f.name}
                  onChange={(e) =>
                    set(
                      "friends",
                      s.friends.map((x, idx) =>
                        idx === i ? { ...x, name: e.target.value } : x
                      )
                    )
                  }
                  placeholder="站点名称"
                />
                <input
                  className={`${INPUT} min-w-40`}
                  value={f.href}
                  onChange={(e) =>
                    set(
                      "friends",
                      s.friends.map((x, idx) =>
                        idx === i ? { ...x, href: e.target.value } : x
                      )
                    )
                  }
                  placeholder="https://example.com"
                />
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    className={BTN_GHOST}
                    onClick={() => set("friends", move(s.friends, i, -1))}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    className={BTN_GHOST}
                    onClick={() => set("friends", move(s.friends, i, 1))}
                    disabled={i === s.friends.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    className="rounded-lg border border-red-100 px-2.5 py-1.5 text-xs text-red-500 transition hover:bg-red-50"
                    onClick={() =>
                      set(
                        "friends",
                        s.friends.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    删除
                  </button>
                </div>
              </div>
              <input
                className={`${INPUT} mt-2`}
                value={f.desc}
                onChange={(e) =>
                  set(
                    "friends",
                    s.friends.map((x, idx) =>
                      idx === i ? { ...x, desc: e.target.value } : x
                    )
                  )
                }
                placeholder="一句话说明（可留空）"
              />
            </div>
          ))}

          {s.friends.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--c-border-3)] p-4 text-center text-xs text-[var(--c-text-4)]">
              还没有友链，点右上角「+ 添加友链」
            </p>
          )}
        </div>

        <FriendCheckPanel current={s.friends} />
      </section>

      {/* AI 封面 */}
      <section className={CARD}>
        <h2 className={TITLE}>AI 封面</h2>
        <p className="mt-1 text-xs text-[var(--c-text-3)]">
          后台「编辑器 → AI 生成封面」会按文章标题与内容调用图像模型生成相关封面。
          默认使用 agnes（model = blog），也可手动改为其它 OpenAI 兼容接口。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>API Key</label>
            <input
              type="password"
              autoComplete="off"
              className={INPUT}
              value={s.aiCoverApiKey}
              onChange={(e) => set("aiCoverApiKey", e.target.value)}
              placeholder="粘贴 agnes 的 API Key（形如 sk-...）"
            />
            <p className="mt-1 text-xs text-[var(--c-text-4)]">
              也可在部署时设置环境变量 AGNES_API_KEY 或 AI_COVER_API_KEY，不会进入数据库。
            </p>
          </div>
          <div>
            <label className={LABEL}>模型 ID</label>
            <input
              className={INPUT}
              value={s.aiCoverModel}
              onChange={(e) => set("aiCoverModel", e.target.value)}
              placeholder="agnes-image-2.0-flash"
            />
          </div>
          <div>
            <label className={LABEL}>API Base URL</label>
            <input
              className={INPUT}
              value={s.aiCoverBaseUrl}
              onChange={(e) => set("aiCoverBaseUrl", e.target.value)}
              placeholder="https://apihub.agnes-ai.com/v1"
            />
          </div>
        </div>
      </section>

      {/* 版权行 */}
      <section className={CARD}>
        <h2 className={TITLE}>页脚 · 底部信息</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>版权文字（{"{year}"} 自动替换为年份，支持 [文字](链接) 超链接）</label>
            <input
              className={INPUT}
              value={s.copyright}
              onChange={(e) => set("copyright", e.target.value)}
              placeholder="© {year} 曦微博客系统 XiviBlogSystem"
            />
          </div>
          <div>
            <label className={LABEL}>底部备注（支持 [文字](链接) 超链接）</label>
            <input
              className={INPUT}
              value={s.footnote}
              onChange={(e) => set("footnote", e.target.value)}
              placeholder="部署于 [Cloudflare Workers](https://www.cloudflare.com)"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>
              备案号（留空不显示；默认链到工信部，可用 [文字](链接) 自定义链接）
            </label>
            <input
              className={INPUT}
              value={s.icp}
              onChange={(e) => set("icp", e.target.value)}
              placeholder="如：京ICP备00000000号"
            />
          </div>
        </div>
      </section>

      {/* 保存 */}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] px-4 py-3 shadow-sm">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-[var(--c-text-2)]">
          <input
            type="checkbox"
            checked={s.autoUpdate === true}
            onChange={(e) => set("autoUpdate", e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          自动检测更新（后台访问时静默对比 GitHub，不会自动安装）
        </label>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[var(--brand)] px-5 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
        >
          {saving ? "保存中…" : "保存设置"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg.type === "ok" ? "text-[var(--brand-deep)]" : "text-red-500"}`}
          >
            {msg.text}
          </span>
        )}
      </div>

      {msg?.type === "err" && (
        <div className="fixed inset-x-0 top-0 z-[100] bg-red-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          ⚠️ 保存失败：{msg.text}（当前页面内容未丢失，可直接重试）
        </div>
      )}
    </div>
  );
}
