import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1";
const DEFAULT_MODEL = "agnes-image-2.0-flash";

/* ---------- 提示词构造：贴近文章内容 ---------- */

/** 去掉 markdown / html / 代码噪声，留下最能代表主题的纯文本 */
function plainText(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~=\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 构造「标题海报」式封面提示词。
 *
 * agnes 的图像模型（2.0 / 2.1 / 2.5 flash）都会在画面里渲染文字，
 * 强行要求「无文字」效果很差（会冒出重复或拼错的字母），
 * 因此改为顺水推舟：把文章标题作为画面唯一文字，成品即一张干净的封面卡。
 */
function buildPrompt(p: {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
}): string {
  const plainTitle = p.title.trim();
  const excerpt = plainText(p.excerpt).slice(0, 40);
  const body = plainText(p.content).slice(0, 60);
  const headline = (plainTitle || excerpt || body || "技术博客").slice(0, 48);

  const hints = [p.category, ...p.tags.split(",")]
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("、");

  const style =
    "现代扁平插画风格，柔和渐变背景，极简几何图形点缀，干净的版面构图，质感高级";

  return (
    "生成一张中文科技博客封面图。" +
    `画面中央用粗体中文清晰写出标题「${headline}」，标题必须准确无误、不要重复、不要出现错别字。` +
    `背景为${style}。` +
    (hints ? `整体气质与「${hints}」这类技术主题相符，但不要把标签当成文字画出来。` : "") +
    "画面中除标题文字外，不要出现任何其它文字、字母、数字、logo、字标或水印（尤其不要出现 XIVI 字样）。"
  );
}

/* ---------- 路由 ---------- */

/**
 * 返回「本次生图所需的调用参数」，由浏览器直连上游服务。
 *
 * 为什么不直接在 Worker 里请求上游：Cloudflare Worker 的共享出口 IP
 * 会被 agnes 前端的 Cloudflare 限流（HTTP 429 / error code 1015），
 * 而浏览器用的是访客自己的 IP，不会触发该限制。
 * 接口本身要求登录，密钥只返回给已登录的后台用户。
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    excerpt?: string;
    content?: string;
    category?: string;
    tags?: string;
  } | null;

  if (
    !body ||
    (!body.title?.trim() && !body.excerpt?.trim() && !body.content?.trim())
  ) {
    return NextResponse.json(
      { error: "请先填写标题或摘要，AI 需要根据内容生成封面" },
      { status: 400 }
    );
  }

  // API Key 优先级：环境变量 > 站点设置（自托管用环境变量）
  let apiKey =
    (typeof process.env.AGNES_API_KEY === "string" && process.env.AGNES_API_KEY) ||
    (typeof process.env.AI_COVER_API_KEY === "string" &&
      process.env.AI_COVER_API_KEY) ||
    "";

  const settings = await getSettings();
  if (!apiKey) apiKey = settings.aiCoverApiKey || "";

  const model = settings.aiCoverModel?.trim() || DEFAULT_MODEL;
  const baseUrl = settings.aiCoverBaseUrl?.trim() || DEFAULT_BASE_URL;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/images/generations`;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "未配置 AI 封面 API Key。请在「站点设置 → AI 封面」填入 Key，或在部署时设置 AGNES_API_KEY 环境变量。",
      },
      { status: 400 }
    );
  }

  const prompt = buildPrompt({
    title: body.title || "",
    excerpt: body.excerpt || "",
    content: body.content || "",
    category: body.category || "",
    tags: body.tags || "",
  });

  return NextResponse.json({
    ok: true,
    endpoint,
    key: apiKey,
    model,
    prompt,
  });
}
