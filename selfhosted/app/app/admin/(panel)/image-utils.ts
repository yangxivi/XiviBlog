"use client";

/** 把任意图片 Blob（本地文件 / 远程抓取）压成内嵌 base64 JPEG；
 *  传 cropTo 时按该尺寸做中心裁切（封面缩略图用，轮播清晰度匹配） */
export function compressImage(
  blob: Blob,
  maxEdge = 800,
  quality = 0.82,
  cropTo?: { w: number; h: number },
  mime: "image/jpeg" | "image/webp" = "image/jpeg"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        let sx = 0;
        let sy = 0;
        let sw = width;
        let sh = height;

        if (cropTo) {
          // 中心裁切出 cropTo 的宽高比，再缩放到目标尺寸
          const targetRatio = cropTo.w / cropTo.h;
          const srcRatio = width / height;
          if (srcRatio > targetRatio) {
            sw = Math.round(height * targetRatio);
            sx = Math.round((width - sw) / 2);
          } else {
            sh = Math.round(width / targetRatio);
            sy = Math.round((height - sh) / 2);
          }
          width = cropTo.w;
          height = cropTo.h;
        } else {
          if (width > height && width > maxEdge) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else if (height > maxEdge) {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas 不可用"));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        const out = canvas.toDataURL(mime, quality);
        // 浏览器不支持该格式时会静默回落成 PNG，这里兜一层 JPEG
        resolve(
          out.startsWith(`data:${mime}`)
            ? out
            : canvas.toDataURL("image/jpeg", quality)
        );
      };
      img.onerror = () => reject(new Error("图片解析失败"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(blob);
  });
}

/** 本地文件输入 → 压缩成 base64 */
export async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 800,
  quality = 0.82
): Promise<string> {
  return compressImage(file, maxEdge, quality);
}

/**
 * 列表缩略图（cover_thumb 列专用）：240×135 中心裁切小图，WebP 约 2-3KB。
 * 列表/RSC flight 里几十上百张封面全靠它控制页面体积；
 * 轮播大图走原图（cover_image 列），不经此列。
 * 用 WebP 而非 JPEG：同尺寸下体积约为 JPEG 的 60%，画质肉眼无差。
 */
export async function makeListThumb(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return compressImage(blob, 480, 0.6, { w: 240, h: 135 }, "image/webp");
}

/** 与前台列表占位同款的黄色渐变色对（PostListItem.gradients 保持一致） */
const GRADIENT_PAIRS: Array<[string, string]> = [
  ["#FFD000", "#FFA800"],
  ["#FFC700", "#FF8A00"],
  ["#FFB800", "#FF6B00"],
  ["#FFE066", "#FFB300"],
  ["#FFCC33", "#FF9500"],
];

/** 无封面文章的占位封面：635×360 黄色渐变 + 分类/标签前两字（与列表占位同款同色） */
export function makeGradientCover(label: string): Promise<string> {
  const text = (label || "曦微").trim().slice(0, 2) || "曦微";
  let sum = 0;
  for (let i = 0; i < label.length; i++) sum += label.charCodeAt(i);
  const [from, to] = GRADIENT_PAIRS[sum % GRADIENT_PAIRS.length];

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 635;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("canvas 不可用"));
    const g = ctx.createLinearGradient(0, 0, 635, 360);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 635, 360);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "bold 96px system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 635 / 2, 360 / 2 + 6);
    resolve(canvas.toDataURL("image/jpeg", 0.85));
  });
}

/* ---------- AI 封面生成（编辑器「AI 换一张」与后台批量共用） ----------
   服务端 /api/cover 只负责「按文章内容构造提示词 + 下发调用参数」，
   真正的生图请求由浏览器直连 agnes：Worker 的共享出口 IP 会被上游
   Cloudflare 限流（429 / 1015），而浏览器用的是访客自己的 IP。 */

/** 会话内记忆生图尺寸：模型不支持 16:9 时记住回落值，避免每篇都白打失败请求 */
let aiCoverSize: "1344x768" | "1024x1024" | null = null;

/** 按文章内容生成契合主题的 AI 封面，返回 635×360 中心裁切后的 data URL */
export async function generateAiCover(p: {
  title: string;
  excerpt?: string;
  content?: string;
  category?: string;
  tags?: string;
}): Promise<string> {
  const cfgRes = await fetch("/api/cover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: p.title,
      excerpt: p.excerpt || "",
      content: p.content || "",
      category: p.category || "",
      tags: p.tags || "",
    }),
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

  const call = async (size: string) => {
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
        size,
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
  try {
    // 优先 16:9（贴近 635×360 展示比例）；模型不支持时回落 1024x1024 并记住
    json = await call(aiCoverSize ?? "1344x768");
    aiCoverSize = aiCoverSize ?? "1344x768";
  } catch {
    try {
      await new Promise((r) => setTimeout(r, 3000));
      json = await call(aiCoverSize ?? "1344x768");
      aiCoverSize = aiCoverSize ?? "1344x768";
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      json = await call("1024x1024");
      aiCoverSize = "1024x1024";
    }
  }

  const item = json.data?.[0];
  if (!item?.b64_json && !item?.url) {
    throw new Error("生图服务未返回图片，请重试");
  }
  const src = item.b64_json
    ? `data:${item.b64_json.startsWith("/9j/") ? "image/jpeg" : "image/png"};base64,${item.b64_json}`
    : (item.url as string);

  const blob = await (await fetch(src)).blob();
  // 直接按 635×360 中心裁切（与轮播展示比例一致）
  return compressImage(blob, 800, 0.82, { w: 635, h: 360 });
}
