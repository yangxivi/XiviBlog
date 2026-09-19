"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import CoverThumb from "@/app/components/CoverThumb";
import RevisionPanel from "./revision-panel";
import {
  compressImage,
  generateAiCover,
  makeListThumb,
} from "./image-utils";
import { renderMarkdown } from "@/lib/markdown";
import { localInputToUtc, utcToLocalInput } from "@/lib/datetime";
import type { RevisionRow } from "@/lib/revisions";

export type EditorPost = {
  id?: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string;
  /** 封面缩略图（320px 小图 base64），列表/侧栏展示用，避免列表 HTML 膨胀 */
  cover_thumb: string;
  content: string;
  /** 分类（列表页显示在文章卡上，也作为标签云统计维度） */
  tag: string;
  /** 附加标签，逗号分隔，列表页取前 3 个展示 */
  tags: string;
  status: "draft" | "published";
  /** 置顶 */
  pinned: boolean;
  /** UTC 'YYYY-MM-DD HH:MM:SS'，空串 = 到点即发 / 立即发布 */
  publish_at: string;
};

/** 内容快照：用来判断是否有未保存的改动（不含 id/slug/status） */
function snapshotOf(p: EditorPost): string {
  return [
    p.title,
    p.excerpt,
    p.content,
    p.cover_image,
    p.cover_thumb,
    p.tag,
    p.tags,
    p.pinned ? "1" : "0",
    p.publish_at,
  ].join("\u0000");
}

/** 由任意封面 data URL 生成 240×135 列表小图（cover_thumb 列；轮播用原图，不经此列） */
async function makeThumb(dataUrl: string): Promise<string> {
  try {
    if (!dataUrl.startsWith("data:image")) return "";
    return await makeListThumb(dataUrl);
  } catch {
    return "";
  }
}

/* 封面生成已抽到 image-utils.generateAiCover（服务端 /api/cover 构造提示词，
   浏览器直连 agnes 生图），编辑器「AI 换一张」与后台批量共用，见 genCover */

const Preview = forwardRef<
  HTMLDivElement,
  { content: string; onScroll?: () => void }
>(function Preview({ content, onScroll }, ref) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="prose-xivi min-h-0 flex-1 overflow-auto p-5 text-[15px]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/* ===================== AI 生图弹窗（agnes，与 AI 封面共用 Key） ===================== */

const GEN_SIZES: { key: string; label: string; w: number; h: number }[] = [
  { key: "1024x1024", label: "正方形 1:1", w: 1024, h: 1024 },
  { key: "1344x768", label: "横版 16:9", w: 1344, h: 768 },
  { key: "768x1344", label: "竖版 9:16", w: 768, h: 1344 },
];

/** 会话内记忆回落：所选比例不被模型支持时记住回落 1:1，避免每次都白打失败请求 */
let genImageFallbackToSquare = false;

function GenImageModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (dataUrl: string, alt: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const generate = async () => {
    if (!prompt.trim()) {
      setErr("请先描述要生成的图像");
      return;
    }
    setErr("");
    setBusy(true);

    try {
      // ① 服务端只下发调用参数（Key 存在「站点设置 → AI 封面」，与封面共用）
      const cfgRes = await fetch("/api/gen-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const cfg = (await cfgRes.json().catch(() => null)) as {
        ok?: boolean;
        endpoint?: string;
        key?: string;
        model?: string;
        prompt?: string;
        error?: string;
      } | null;
      if (!cfgRes.ok || !cfg?.ok || !cfg.endpoint || !cfg.key) {
        throw new Error(cfg?.error || `HTTP ${cfgRes.status}`);
      }

      // ② 浏览器直连 agnes：Worker 的共享出口 IP 会被上游 Cloudflare 限流
      //    （429 / 1015），浏览器用的是访客自己的 IP
      const call = async (sz: string) => {
        const r = await fetch(cfg.endpoint as string, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.key}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            prompt: cfg.prompt,
            n: 1,
            size: sz,
            response_format: "b64_json",
          }),
        });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`生图服务返回 ${r.status}：${t.slice(0, 160)}`);
        }
        return (await r.json()) as {
          data?: Array<{ url?: string; b64_json?: string }>;
        };
      };

      let json: { data?: Array<{ url?: string; b64_json?: string }> };
      const want = genImageFallbackToSquare ? "1024x1024" : size;
      try {
        json = await call(want);
      } catch {
        // 所选比例不被模型支持时回落 1:1 并记住（与 AI 封面同款策略）
        await new Promise((r) => setTimeout(r, 3000));
        json = await call("1024x1024");
        genImageFallbackToSquare = true;
      }

      const item = json.data?.[0];
      if (!item?.b64_json && !item?.url) {
        throw new Error("生图服务未返回图片，请重试");
      }
      const src = item.b64_json
        ? `data:${item.b64_json.startsWith("/9j/") ? "image/jpeg" : "image/png"};base64,${item.b64_json}`
        : (item.url as string);
      const blob = await (await fetch(src)).blob();
      // 压缩后转 data URL，与正文其它插图一致（内嵌存储，无需图床）
      const dataUrl = await compressImage(blob, 1000, 0.82);
      setImg(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? `生成失败：${e.message}` : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--c-text)]">
            AI 生图
            <span className="ml-2 text-xs font-normal text-[var(--c-text-3)]">
              agnes · 与 AI 封面共用 Key
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--c-text-3)] transition hover:bg-[var(--c-soft)]"
          >
            关闭
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要的图像，例如：一只戴眼镜的柴犬在电脑前写代码，扁平插画风格，柔和配色"
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--c-border-3)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="h-9 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          >
            {GEN_SIZES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => generate()}
            disabled={busy}
            className="rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {busy ? "生成中…" : "生成"}
          </button>
          {img && (
            <button
              type="button"
              onClick={() => generate()}
              disabled={busy}
              className="rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-sm text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-60"
            >
              换一张
            </button>
          )}
        </div>

        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {err}
          </p>
        )}

        {img && (
          <div className="mt-4">
            <div className="flex justify-center rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt="预览"
                className="max-h-64 rounded-lg object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const alt = prompt
                  .trim()
                  .replace(/\.[^.]+$/, "")
                  .replace(/[[\]()]/g, "")
                  .slice(0, 40);
                onInsert(img, alt);
              }}
              className="mt-3 w-full rounded-lg bg-[var(--brand-deep)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              插入到正文
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== 工具栏图标 ===================== */

const IconH2 = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M4 14v-2h3V6h2v6h3v2H4zm13-2h-2V6h-2v6H9v2h6v2h2v-2h2v-2h-2z" />
  </svg>
);
const IconH3 = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M4 14v-2h3V6h2v6h3v2H4zm12-6h-2v2h2c.55 0 1 .45 1 1s-.45 1-1 1h-1v2h1c.55 0 1 .45 1 1s-.45 1-1 1h-2v2h2c1.66 0 3-1.34 3-3s-.67-2.17-1.67-2.65c1-.48 1.67-1.46 1.67-2.58 0-1.66-1.34-3-3-3z" />
  </svg>
);
const IconBold = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
  </svg>
);
const IconItalic = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
  </svg>
);
const IconLink = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
);
const IconImage = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
  </svg>
);
const IconQuote = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
  </svg>
);
const IconCode = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
  </svg>
);
const IconUl = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
  </svg>
);
const IconOl = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
  </svg>
);
const IconHr = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M19 13H5v-2h14v2z" />
  </svg>
);
const IconInlineCode = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M8.7 15.9 4.8 12l3.9-3.9L7.3 6.7 2 12l5.3 5.3 1.4-1.4zm6.6 0 3.9-3.9-3.9-3.9 1.4-1.4L22 12l-5.3 5.3-1.4-1.4z" />
  </svg>
);
const IconStrike = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M10 19h4v-3h-4v3zM18 4H6v3h12V4zM4 11h16v2H4v-2z" />
  </svg>
);
const IconTable = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M20 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM5 5h6v3H5V5zm8 0h6v3h-6V5zM5 10h6v4H5v-4zm8 0h6v4h-6v-4zM5 16h6v3H5v-3zm8 0h6v3h-6v-3z" />
  </svg>
);
const IconTask = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8c1.48 0 2.86.41 4.05 1.12l1.45-1.45A9.93 9.93 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.73 0 3.36-.44 4.78-1.22l-1.45-1.45A7.9 7.9 0 0 1 12 20z" />
  </svg>
);
const IconUpload = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
  </svg>
);
const IconSync = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    {on ? (
      <path d="M12 4V1L8 5l4 4V6a6 6 0 0 1 6 6 5.9 5.9 0 0 1-.6 2.6l1.5 1.5A8 8 0 0 0 20 12a8 8 0 0 0-8-8zm0 14a6 6 0 0 1-6-6c0-.94.22-1.83.6-2.6L5.1 7.9A8 8 0 0 0 4 12a8 8 0 0 0 8 8v3l4-4-4-4v3z" />
    ) : (
      <path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h16v2H4v-2zm0 4h16v2H4v-2z" />
    )}
  </svg>
);
const IconSparkle = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2zm7 9l.9 2.5L22 14l-2.1.5L19 17l-.9-2.5L16 14l2.1-.5L19 11zm-12 1l.7 1.9L9 14.6l-1.3.4L7 17l-.7-1.9L5 14.6l1.3-.4L7 12z" />
  </svg>
);

/* ===================== 编辑器主体 ===================== */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Editor({ initial }: { initial: EditorPost }) {
  const router = useRouter();
  const [post, setPost] = useState<EditorPost>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<"split" | "edit" | "preview">("edit");
  const [aiBusy, setAiBusy] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- 自动保存草稿 ---------- */
  const [autoState, setAutoState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [autoAt, setAutoAt] = useState("");
  const [autoErr, setAutoErr] = useState("");
  /** 是否有未落库的改动（同时镜像到 ref，供 beforeunload 读取） */
  const [dirty, setDirty] = useState(false);
  const postRef = useRef(post);
  postRef.current = post;
  const lastSavedRef = useRef(snapshotOf(initial));
  const dirtyRef = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof EditorPost>(k: K, v: EditorPost[K]) =>
    setPost((p) => ({ ...p, [k]: v }));

  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * 定时发布时间用 <input type="datetime-local">，值必须是浏览器本地时间。
   * 服务端渲染时区不同（Workers 是 UTC），所以挂载后再填，避免 hydration 不一致。
   */
  const [publishLocal, setPublishLocal] = useState("");
  useEffect(() => {
    setPublishLocal(utcToLocalInput(initial.publish_at));
    // 只在首次挂载时把 UTC 转成本地时间
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPublishLocal = (v: string) => {
    setPublishLocal(v);
    set("publish_at", localInputToUtc(v));
  };
  /** 拉取已有分类（含初始值，确保下拉里有当前分类） */
  useEffect(() => {
    let active = true;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const data = j as { categories?: { name: string }[] };
        const list = (data.categories ?? []).map((c) => c.name);
        const setList = new Set(list);
        if (initial.tag) setList.add(initial.tag);
        setCategories([...setList]);
      })
      .catch(() => {
        if (active) setCategories(initial.tag ? [initial.tag] : []);
      });
    return () => {
      active = false;
    };
  }, [initial.tag]);

  /** 正文插图：工具栏上传 / Ctrl+V 粘贴 / 拖拽 共用 */
  const contentFileRef = useRef<HTMLInputElement>(null);
  /** 分屏右侧预览容器，用于滚动同步 */
  const previewRef = useRef<HTMLDivElement>(null);
  const syncLock = useRef(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const [dragging, setDragging] = useState(false);
  /** 版本历史抽屉 */
  const [showRev, setShowRev] = useState(false);
  /** 分类下拉：已有分类列表 + 是否处于新建模式 */
  const [categories, setCategories] = useState<string[]>([]);
  const [catMode, setCatMode] = useState<"select" | "input">("select");

  /** 从版本历史恢复：内容由服务端写好，这里同步编辑器状态，避免整页刷新丢焦点 */
  const onRestore = (rev: RevisionRow) => {
    const next: EditorPost = {
      ...postRef.current,
      title: rev.title,
      excerpt: rev.excerpt,
      content: rev.content,
      cover_image: rev.cover_image,
      tag: rev.tag,
      tags: (rev as unknown as { tags?: string }).tags ?? postRef.current.tags,
      status: rev.status === "published" ? "published" : "draft",
    };
    setPost(next);
    // 版本快照不含缩略图，封面变化时现场补一张（失败则回落原图）
    makeThumb(rev.cover_image).then((thumb) => {
      setPost((p) =>
        p.cover_image === rev.cover_image ? { ...p, cover_thumb: thumb } : p
      );
    });
    lastSavedRef.current = snapshotOf(next);
    dirtyRef.current = false;
    setDirty(false);
    setAutoState("idle");
    setMsg(`已恢复到 ${rev.created_at} 的版本`);
    setShowRev(false);
    router.refresh();
  };

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      if (dataUrl.length * 0.75 > 950 * 1024) {
        setMsg("封面图过大，请选更小图片（建议最长边 ≤ 800px）");
        return;
      }
      set("cover_image", dataUrl);
      set("cover_thumb", await makeThumb(dataUrl));
      setMsg("封面图已上传并压缩");
    } catch {
      setMsg("图片读取失败");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ---------- AI 生成封面 ----------
     服务端 /api/cover 只负责「按文章内容构造提示词 + 下发调用参数」，
     真正的生图请求由浏览器直连 agnes：Worker 的共享出口 IP 会被上游
     Cloudflare 限流（429 / 1015），而浏览器用的是访客自己的 IP。
     接口要求登录，密钥只会下发给已登录的后台用户。 */
  const genCover = async () => {
    if (!post.title.trim() && !post.excerpt.trim() && !post.content.trim()) {
      setMsg("请先填写标题或摘要，AI 需要根据内容生成封面");
      return;
    }
    setAiBusy(true);
    setMsg("AI 正在根据文章内容生成封面，约 5-20 秒…");
    try {
      // 生图链路封装在 image-utils.generateAiCover（服务端构造提示词，浏览器直连 agnes）
      const dataUrl = await generateAiCover({
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.tag,
        tags: post.tags,
      });
      set("cover_image", dataUrl);
      set("cover_thumb", await makeThumb(dataUrl));
      setMsg("AI 封面已生成并压缩入库");
    } catch (e) {
      setMsg(`生成失败：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setAiBusy(false);
    }
  };

  const setTitleAndSlug = (title: string) => {
    setPost((p) => ({
      ...p,
      title,
      slug: p.slug || title ? slugify(title) : "",
    }));
  };

  /* ---------- textarea 工具函数 ---------- */
  const wrapSelection = (before: string, after: string, placeholder = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const raw = post.content;
    const selected = raw.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    const newContent = raw.slice(0, start) + replacement + raw.slice(end);
    set("content", newContent);
    const cursorAt = start + before.length + selected.length;
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(cursorAt, cursorAt);
    }, 0);
  };

  const prefixLines = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const raw = post.content;
    const before = raw.slice(0, start);
    const after = raw.slice(end);
    const selected = raw.slice(start, end);
    const lines = selected.length ? selected.split("\n") : [""];
    const prefixed = lines.map((l) => `${prefix}${l}`).join("\n");
    const newContent = before + prefixed + after;
    set("content", newContent);
    const newEnd = start + prefixed.length;
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newEnd, newEnd);
    }, 0);
  };

  const insertBlock = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const raw = post.content;
    const padBefore = raw[start - 1] === "\n" || start === 0 ? "" : "\n\n";
    const padAfter = raw[end] === "\n" || end === raw.length ? "" : "\n\n";
    const replacement = `${padBefore}${text}${padAfter}`;
    const newContent = raw.slice(0, start) + replacement + raw.slice(end);
    set("content", newContent);
    const cursorAt = start + replacement.length;
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(cursorAt, cursorAt);
    }, 0);
  };

  /* ---------- 正文插图：上传 / 粘贴 / 拖拽 ---------- */

  /** 压缩后以 Markdown 图片语法插入光标处（内嵌 data URL，无需图床） */
  const insertInlineImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setMsg("只能插入图片文件（png / jpg / gif / webp）");
      return;
    }
    setMsg("图片压缩中…");
    try {
      const dataUrl = await compressImage(file, 1200, 0.82);
      if (dataUrl.length * 0.75 > 1400 * 1024) {
        setMsg("图片过大，请压缩后再插入（建议最长边 ≤ 1200px）");
        return;
      }
      const name = (file.name || "image")
        .replace(/\.[^.]+$/, "")
        .replace(/[[\]]/g, "")
        .slice(0, 40);
      insertBlock(`![${name}](${dataUrl})`);
      setMsg("图片已插入正文（内嵌存储，无需图床）");
    } catch {
      setMsg("图片读取失败");
    }
  };

  const onPickContentImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) await insertInlineImage(f);
    if (contentFileRef.current) contentFileRef.current.value = "";
  };

  /** 粘贴：剪贴板里有图片就直接插入（粘贴 base64 文本走浏览器默认行为） */
  const onPasteContent = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const hit = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
    let file = hit?.getAsFile() ?? null;
    if (!file) {
      file =
        Array.from(e.clipboardData?.files ?? []).find((f) =>
          f.type.startsWith("image/")
        ) ?? null;
    }
    if (file) {
      e.preventDefault();
      void insertInlineImage(file);
    }
  };

  const onDropContent = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const file =
      Array.from(e.dataTransfer?.files ?? []).find((f) =>
        f.type.startsWith("image/")
      ) ?? null;
    setDragging(false);
    if (file) {
      e.preventDefault();
      void insertInlineImage(file);
    }
  };

  /* ---------- 分屏滚动同步 ---------- */

  const syncFrom = useCallback(
    (from: "edit" | "preview") => {
      if (!syncScroll || view !== "split") return;
      const ta = textareaRef.current;
      const pv = previewRef.current;
      if (!ta || !pv || syncLock.current) return;

      const src = from === "edit" ? ta : pv;
      const dst = from === "edit" ? pv : ta;
      const srcMax = src.scrollHeight - src.clientHeight;
      const dstMax = dst.scrollHeight - dst.clientHeight;
      if (srcMax <= 0 || dstMax <= 0) return;

      const ratio = src.scrollTop / srcMax;
      const next = Math.round(ratio * dstMax);
      if (Math.abs(dst.scrollTop - next) < 2) return;

      syncLock.current = true;
      dst.scrollTop = next;
      requestAnimationFrame(() => {
        syncLock.current = false;
      });
    },
    [syncScroll, view]
  );

  /* ---------- 工具栏动作 ---------- */
  const toolbarActions = [
    { icon: IconH2, title: "二级标题 (##)", action: () => prefixLines("## ") },
    { icon: IconH3, title: "三级标题 (###)", action: () => prefixLines("### ") },
    { icon: IconBold, title: "粗体 (Ctrl+B)", action: () => wrapSelection("**", "**", "粗体文字") },
    { icon: IconItalic, title: "斜体 (Ctrl+I)", action: () => wrapSelection("*", "*", "斜体文字") },
    { icon: IconStrike, title: "删除线", action: () => wrapSelection("~~", "~~", "删除线文字") },
    { icon: IconInlineCode, title: "行内代码 (Ctrl+`)", action: () => wrapSelection("`", "`", "代码") },
    { icon: IconLink, title: "链接 (Ctrl+K)", action: () => wrapSelection("[", "](https://)", "链接文字") },
    {
      icon: IconUpload,
      title: "上传图片到正文（也可直接 Ctrl+V 粘贴 / 拖入）",
      action: () => contentFileRef.current?.click(),
    },
    { icon: IconImage, title: "插入外链图片（URL）", action: () => insertBlock("![图片说明](https://)") },
    { icon: IconQuote, title: "引用", action: () => prefixLines("> ") },
    { icon: IconCode, title: "代码块", action: () => insertBlock("```\n代码\n```") },
    { icon: IconUl, title: "无序列表", action: () => prefixLines("- ") },
    { icon: IconOl, title: "有序列表", action: () => prefixLines("1. ") },
    {
      icon: IconTask,
      title: "任务列表",
      action: () => insertBlock("- [ ] 待办事项\n- [x] 已完成事项"),
    },
    {
      icon: IconTable,
      title: "表格",
      action: () =>
        insertBlock("| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |"),
    },
    { icon: IconHr, title: "分割线", action: () => insertBlock("---") },
  ];

  /* ---------- 快捷键 ---------- */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const raw = post.content;
        set("content", raw.slice(0, start) + "    " + raw.slice(end));
        setTimeout(() => ta.setSelectionRange(start + 4, start + 4), 0);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "b") {
          e.preventDefault();
          wrapSelection("**", "**", "粗体文字");
        } else if (e.key === "i") {
          e.preventDefault();
          wrapSelection("*", "*", "斜体文字");
        } else if (e.key === "k") {
          e.preventDefault();
          wrapSelection("[", "](https://)", "链接文字");
        } else if (e.key === "`") {
          e.preventDefault();
          wrapSelection("`", "`", "代码");
        } else if (e.key === "s") {
          e.preventDefault();
          save(post.status);
        }
      }
    };

    ta.addEventListener("keydown", onKeyDown);
    return () => ta.removeEventListener("keydown", onKeyDown);
  }, [post.content, post.status]);

  /* ---------- 保存 / 删除 ---------- */
  async function save(status?: "draft" | "published") {
    setSaving(true);
    setMsg("");
    const body = { ...post, status: status ?? post.status };
    try {
      const res = await fetch(
        post.id ? `/api/posts/${post.id}` : "/api/posts",
        {
          method: post.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: number;
      };
      if (!res.ok) {
        setMsg(j.error || "保存失败");
        return;
      }
      // 自动 AI 生图：发布新文章且无封面时自动生成
      const isNewPost = !post.id;
      const shouldAutoGenCover = status === "published" && isNewPost && !body.cover_image;
      if (shouldAutoGenCover && body.title.trim()) {
        try {
          setMsg("正在生成 AI 封面...");
          const dataUrl = await generateAiCover({
            title: body.title,
            excerpt: body.excerpt || "",
            content: body.content || "",
            category: body.tag || "",
            tags: body.tags || "",
          });
          const thumb = await makeThumb(dataUrl);
          // 更新数据库中的封面
          await fetch(`/api/posts/${j.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, cover_image: dataUrl, cover_thumb: thumb }),
          });
          set("cover_image", dataUrl);
          set("cover_thumb", thumb);
          setMsg("已发布，AI 封面已自动生成");
        } catch (coverErr) {
          console.error("AI 封面生成失败:", coverErr);
          setMsg(status === "published" ? "已发布（封面生成失败，可手动生成）" : "已保存");
        }
      } else {
        if (post.id) {
          setMsg(status === "published" ? "已发布" : "已保存");
        } else {
          router.replace(`/admin/edit/${j.id}`);
          setMsg("已创建");
        }
      }
      lastSavedRef.current = snapshotOf(post);
      dirtyRef.current = false;
      setDirty(false);
      setAutoState("idle");
      setAutoErr("");
      router.refresh();
    } catch {
      setMsg("网络错误");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- 自动保存：停止输入 3 秒后写库 ---------- */
  async function autoSave() {
    const p = postRef.current;
    if (!p.id) return; // 新文章要先手动保存一次
    if (!p.title.trim()) return; // 没标题不自动存，避免产生垃圾草稿
    const snap = snapshotOf(p);
    if (snap === lastSavedRef.current) return;

    setAutoState("saving");
    try {
      const res = await fetch(`/api/posts/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // auto=true 让版本历史把这次保存合并进当前写作会话，而不是每次都新建一版
        body: JSON.stringify({ ...p, auto: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      lastSavedRef.current = snap;
      // 若期间又改了内容，标记为未保存，交给下一轮定时器
      const stillDirty = snapshotOf(postRef.current) !== snap;
      dirtyRef.current = stillDirty;
      setDirty(stillDirty);
      setAutoState("saved");
      setAutoAt(
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
      setAutoErr("");
    } catch (e) {
      setAutoState("error");
      setAutoErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    const snap = snapshotOf(post);
    if (snap === lastSavedRef.current) {
      dirtyRef.current = false;
      setDirty(false);
      return;
    }
    dirtyRef.current = true;
    setDirty(true);
    if (!post.id || !post.title.trim()) return;

    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      void autoSave();
    }, 3000);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.title, post.excerpt, post.content, post.cover_image, post.tag, post.tags]);

  // 有未保存改动时提醒
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function remove() {
    if (!post.id || !confirm("确定删除这篇文章？不可恢复。")) return;
    setSaving(true);
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    router.push("/admin/posts");
    router.refresh();
  }

  const wordCount = post.content.replace(/\s/g, "").length;

  return (
    <>
      {/* 元信息区：整行铺开，不参与左右分栏 */}
      <div className="shrink-0">
        {/* 顶部栏 */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push("/admin/posts")}
              className="shrink-0 text-sm text-[var(--c-text-3)] transition hover:text-[var(--brand-deep)]"
            >
              ← 返回列表
            </button>

            {/* 自动保存状态指示 */}
            <span className="flex min-w-0 items-center gap-1.5 text-xs">
              {autoState === "saving" ? (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--brand-deep)]" />
                  <span className="text-[var(--c-text-3)]">保存中…</span>
                </>
              ) : autoState === "error" ? (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  <span className="truncate text-red-500">
                    自动保存失败：{autoErr}
                  </span>
                </>
              ) : !post.id ? (
                <span className="text-[var(--c-text-4)]">
                  新文章需先手动保存一次
                </span>
              ) : dirty ? (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFA940]" />
                  <span className="text-[var(--c-text-3)]">有未保存改动</span>
                </>
              ) : autoState === "saved" ? (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="text-[var(--c-text-3)]">
                    已自动保存 {autoAt}
                  </span>
                </>
              ) : (
                <span className="text-[var(--c-text-4)]">改动会自动保存</span>
              )}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {post.id && (
              <button
                onClick={() => setShowRev(true)}
                title="查看 / 恢复历史版本"
                className="rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
              >
                版本历史
              </button>
            )}
            {post.id && (
              <button
                onClick={remove}
                className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50"
              >
                删除
              </button>
            )}
            <button
              onClick={() => save("draft")}
              disabled={saving}
              className="rounded-lg border border-[var(--c-border-3)] px-4 py-1.5 text-sm text-[var(--c-text-2)] transition hover:border-[var(--c-border-3)] disabled:opacity-50"
            >
              存草稿
            </button>
            <button
              onClick={() => save("published")}
              disabled={saving}
              className="rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              {post.status === "published" ? "更新发布" : "发布"}
            </button>
          </div>
        </div>

        {msg && (
          <p className="mb-4 rounded-lg bg-[var(--c-brand-soft)] px-4 py-2 text-sm text-[var(--brand-deep)]">
            {msg}
          </p>
        )}

        <input
          value={post.title}
          onChange={(e) => setTitleAndSlug(e.target.value)}
          placeholder="文章标题"
          className="w-full border-b border-[var(--c-border-2)] pb-3 text-2xl font-bold outline-none placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)]"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {/* 分类：下拉选择已有 / 输入新建 */}
          {catMode === "select" ? (
            <div className="flex items-center gap-2">
              <select
                value={post.tag}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") {
                    setCatMode("input");
                  } else {
                    set("tag", v);
                  }
                }}
                className="h-9 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-1.5 outline-none focus:border-[var(--brand)]"
              >
                <option value="" disabled>
                  选择分类
                </option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new__">+ 新建分类</option>
              </select>
              <button
                type="button"
                onClick={() => setCatMode("input")}
                className="rounded-lg border border-[var(--c-border-3)] px-2.5 py-1.5 text-xs text-[var(--c-text-3)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
                title="新建分类"
              >
                +
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={post.tag}
                onChange={(e) => set("tag", e.target.value)}
                placeholder="输入新分类名称"
                autoFocus
                className="h-9 w-40 rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 outline-none focus:border-[var(--brand)]"
              />
              <button
                type="button"
                onClick={() => {
                  const v = post.tag.trim();
                  if (!v) {
                    setMsg("分类名称不能为空");
                    return;
                  }
                  if (!categories.includes(v)) setCategories([...categories, v]);
                  setCatMode("select");
                }}
                className="rounded-lg border border-[var(--c-border-3)] px-2.5 py-1.5 text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
              >
                确认
              </button>
              <button
                type="button"
                onClick={() => setCatMode("select")}
                className="rounded-lg border border-[var(--c-border-3)] px-2.5 py-1.5 text-xs text-[var(--c-text-4)] transition hover:border-[var(--c-border)]"
              >
                取消
              </button>
            </div>
          )}
          <input
            value={post.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="附加标签，逗号分隔"
            className="w-56 rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 outline-none focus:border-[var(--brand)]"
          />
          <input
            value={post.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="URL 路径"
            className="w-40 rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs text-[var(--c-text-3)] outline-none focus:border-[var(--brand)]"
          />
          <span className="text-xs text-[var(--c-text-3)]">
            /blog/{post.slug || "自动生成"}
          </span>
          <div className="ml-auto flex items-center rounded-lg border border-[var(--c-border-3)] p-0.5">
            {(["split", "edit", "preview"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  view === v
                    ? "bg-[var(--c-brand-soft)] font-medium text-[var(--brand-deep)]"
                    : "text-[var(--c-text-3)] hover:text-[var(--c-text-2)]"
                }`}
              >
                {v === "split" ? "分屏" : v === "edit" ? "编辑" : "预览"}
              </button>
            ))}
          </div>
        </div>

        <input
          value={post.excerpt}
          onChange={(e) => set("excerpt", e.target.value)}
          placeholder="摘要（列表页显示，一句话）"
          className="mt-3 w-full rounded-lg border border-[var(--c-border-3)] px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
        />

        {/* 发布设置：置顶 + 定时 */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-4 py-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-[var(--c-text-2)]">
            <input
              type="checkbox"
              checked={post.pinned}
              onChange={(e) => set("pinned", e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            置顶（列表与首页优先展示）
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--c-text-2)]">定时发布</span>
            <input
              type="datetime-local"
              value={publishLocal}
              onChange={(e) => onPublishLocal(e.target.value)}
              className="rounded-lg border border-[var(--c-border-3)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            />
            {publishLocal && (
              <button
                type="button"
                onClick={() => onPublishLocal("")}
                className="text-xs text-[var(--c-text-3)] underline-offset-2 transition hover:text-red-500 hover:underline"
              >
                清除
              </button>
            )}
          </div>

          <span className="w-full text-xs text-[var(--c-text-3)] sm:w-auto">
            {publishLocal
              ? `到点前前台不可见，到点自动上线 · 计划：${publishLocal.replace("T", " ")}`
              : "留空 = 立即发布"}
          </span>
        </div>

        {/* 封面/缩略图 */}
        <div className="mt-3 rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--c-text-3)]">封面图</label>
            {post.cover_image && (
              <button
                type="button"
                onClick={() => {
                  set("cover_image", "");
                  set("cover_thumb", "");
                }}
                className="text-xs text-red-500 transition hover:text-red-600"
              >
                移除
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                {post.cover_image ? (
                  <CoverThumb
                    src={post.cover_image}
                    alt="封面预览"
                    className="h-20 w-20 rounded-xl ring-1 ring-[var(--c-border-2)]"
                  />
                ) : (
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl bg-[var(--c-soft)] text-[10px] text-[var(--c-text-4)]">
                    暂无
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickImage}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-sm text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
                  >
                    上传图片
                  </button>
                  <button
                    type="button"
                    onClick={genCover}
                    disabled={aiBusy}
                    className="rounded-lg border border-[var(--brand)] bg-[var(--c-brand-soft)] px-3 py-1.5 text-sm font-medium text-[var(--brand-deep)] transition hover:bg-[var(--c-brand-soft-2)] disabled:opacity-60"
                  >
                    {aiBusy
                      ? "生成中…"
                      : post.cover_image
                        ? "AI 换一张"
                        : "AI 生成封面"}
                  </button>
                  <span className="text-xs text-[var(--c-text-3)]">建议 ≤ 1MB</span>
                </div>
                <input
                  value={
                    post.cover_image.startsWith("data:") ? "" : post.cover_image
                  }
                  onChange={(e) => set("cover_image", e.target.value)}
                  placeholder="或粘贴图片外链 URL"
                  className="w-full rounded-lg border border-[var(--c-border-3)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                />
                <p className="text-xs text-[var(--c-text-3)]">
                  AI 封面由 agnes 按「标题 + 内容 + 分类/标签」生成与文章主题相关的图；首次使用需在「站点设置 →
                  AI 封面」填入 agnes 的 API
                  Key。上传图片会自动压缩后内嵌存储，无需图床；留空则按分类生成渐变色占位图。
                </p>
              </div>
            </div>

            {/* AI 自动排版 */}
            <div className="rounded-xl border border-[var(--c-border-2)] p-5">
              <h3 className="mb-4 text-sm font-semibold text-[var(--c-text)]">AI 自动排版</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!post.content.trim()) {
                      setMsg("请先填写文章内容");
                      return;
                    }
                    setAiBusy(true);
                    setMsg("AI 正在根据曦微风格自动排版，约 5-15 秒…");
                    try {
                      const res = await fetch("/api/format", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: post.title,
                          content: post.content,
                        }),
                      });
                      const j = await res.json().catch(() => ({})) as { ok?: boolean; content?: string; error?: string };
                      if (!res.ok || !j.ok) {
                        setMsg(`排版失败：${j.error || "未知错误"}`);
                        return;
                      }
                      set("content", j.content || post.content);
                      setMsg("AI 排版已完成，请预览确认");
                    } catch (e) {
                      setMsg(`排版失败：${e instanceof Error ? e.message : "网络错误"}`);
                    } finally {
                      setAiBusy(false);
                    }
                  }}
                  disabled={aiBusy}
                  className="rounded-lg border border-[var(--brand)] bg-[var(--c-brand-soft)] px-4 py-2 text-sm font-medium text-[var(--brand-deep)] transition hover:bg-[var(--c-brand-soft-2)] disabled:opacity-60"
                >
                  {aiBusy ? "排版中…" : "AI 自动排版"}
                </button>
                <span className="text-xs text-[var(--c-text-3)]">按曦微风格自动设置标题层级、引用、分割线等</span>
              </div>
              <p className="mt-2 text-xs text-[var(--c-text-3)]">
                需要先在「站点设置 → AI 排版」配置 API Key（默认使用 glm-4.7-flash 免费模型）。
              </p>
            </div>
          </div>
        </div>

        </div>

        {/* 写作区：左编辑 + 右预览。桌面端给一个"视口内"的高度，
            两栏各自内部滚动，滚动同步才有意义 */}
        <div className="mt-4 flex flex-col lg:h-[calc(100vh_-_4rem)] lg:flex-row lg:gap-6">
          <div className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] p-1.5">
          <input
            ref={contentFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPickContentImage}
          />
          {toolbarActions.map((t, idx) => (
            <button
              key={idx}
              type="button"
              title={t.title}
              onClick={t.action}
              className="rounded-md p-2 text-[var(--c-text-2)] transition hover:bg-[var(--c-card)] hover:text-[var(--brand-deep)] hover:shadow-sm"
            >
              <t.icon />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-[var(--c-border-2)]" />
          <button
            type="button"
            title="AI 生图（agnes，与 AI 封面共用 Key）"
            onClick={() => setShowGen(true)}
            className="rounded-md p-2 text-[#FF8A00] transition hover:bg-[var(--c-card)] hover:shadow-sm"
          >
            <IconSparkle />
          </button>
            <span className="ml-auto flex items-center gap-3 text-xs text-[var(--c-text-3)]">
              <button
                type="button"
                onClick={() => {
                  if (view === "edit") {
                    setView("split");
                  } else {
                    setView("edit");
                  }
                }}
                className="hidden items-center gap-1 rounded-md border border-[var(--c-border-3)] px-2 py-1 transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] sm:inline-flex"
                title={view === "edit" ? "展开实时预览" : "隐藏实时预览"}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  {view === "edit" ? (
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
                  ) : (
                    <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.057 7.066 19 12 19c.394 0 .779-.014 1.16-.04m2.185-2.186A10.43 10.43 0 0 0 15.536 12a10.477 10.477 0 0 0-1.597-2.252m2.185 2.186L21 21m0 0L3 3m18 18L3.98 8.223" />
                  )}
                </svg>
                {view === "edit" ? "展开预览" : "隐藏预览"}
              </button>
              <label
                className="hidden cursor-pointer select-none items-center gap-1.5 sm:flex"
                title="编辑区与预览区按比例同步滚动"
              >
                <input
                  type="checkbox"
                  checked={syncScroll}
                  onChange={(e) => setSyncScroll(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--brand)]"
                />
                <IconSync on={syncScroll} />
                同步滚动
              </label>
              <span className="hidden lg:inline">Ctrl+S 保存 · {wordCount} 字</span>
            </span>
        </div>

        {/* 编辑区 */}
        {(view === "split" || view === "edit") && (
          <textarea
            ref={textareaRef}
            value={post.content}
            onChange={(e) => set("content", e.target.value)}
            onPaste={onPasteContent}
            onScroll={() => syncFrom("edit")}
            onDragOver={(e) => {
              if (Array.from(e.dataTransfer?.items ?? []).some((it) => it.kind === "file")) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDropContent}
            placeholder="在这里写正文…
支持 Markdown：## 标题、**粗体**、*斜体*、~~删除线~~、`代码`、[链接](url)、- 列表、- [ ] 任务、> 引用、``` 代码块、| 表格 |
图片可直接 Ctrl+V 粘贴或拖进来，会自动压缩内嵌（无需图床）"
            spellCheck={false}
            className={`mt-4 min-h-[420px] flex-1 rounded-xl border p-5 font-mono text-sm leading-7 outline-none transition lg:min-h-0 ${
              dragging
                ? "border-[var(--brand)] bg-[var(--c-brand-soft)]"
                : "border-[var(--c-border-3)] focus:border-[var(--brand)]"
            }`}
          />
        )}
      </div>

      {/* 右侧：实时预览 */}
      {(view === "split" || view === "preview") && (
        <div
          className={`mt-6 flex flex-col rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] lg:mt-0 lg:min-h-0 lg:flex-1 ${
            view === "preview" ? "min-h-[60vh]" : "min-h-[420px] lg:min-h-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--c-border-2)] px-4 py-2">
            <span className="text-xs font-medium text-[var(--c-text-3)]">实时预览</span>
            <span className="text-xs text-[var(--c-text-3)]">
              {post.status === "published" ? "已发布" : "草稿"}
            </span>
          </div>
          <Preview
            ref={previewRef}
            content={post.content}
            onScroll={() => syncFrom("preview")}
          />
        </div>
      )}
        </div>

      {showRev && post.id ? (
        <RevisionPanel
          postId={post.id}
          current={{ title: post.title, content: post.content }}
          onClose={() => setShowRev(false)}
          onRestore={onRestore}
        />
      ) : null}

      {showGen && (
        <GenImageModal
          onClose={() => setShowGen(false)}
          onInsert={(dataUrl, alt) => {
            insertBlock(`![${alt}](${dataUrl})`);
            setShowGen(false);
            setMsg("AI 图片已插入正文（内嵌存储，无需图床）");
          }}
        />
      )}
    </>
  );
}
