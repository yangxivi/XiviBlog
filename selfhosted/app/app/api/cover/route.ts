import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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
 * 七套主题色渐变底 —— 与前台 globals.css 的七个 --brand 主题一一对应。
 * c1/c2 为「品牌色混白」的浅色渐变对（保证深色标题可读），accent/deep 供纹样用。
 */
const THEMES = [
  { name: "暖黄", c1: "#FFF3C9", c2: "#FFDF82", accent: "#FFB300", deep: "#9A6B00" },
  { name: "微信绿", c1: "#D9F6E5", c2: "#9FEDC6", accent: "#07C160", deep: "#057A43" },
  { name: "知乎蓝", c1: "#DAEAFF", c2: "#A5CCFF", accent: "#1772F6", deep: "#0A4BB0" },
  { name: "腾讯蓝", c1: "#D8E2FF", c2: "#A9C0FF", accent: "#0052D9", deep: "#003A9E" },
  { name: "小红书红", c1: "#FFDFE6", c2: "#FFB9C6", accent: "#FF2442", deep: "#C01030" },
  { name: "雅紫", c1: "#EEE5FF", c2: "#CDB6FF", accent: "#7C3AED", deep: "#5B21B6" },
  { name: "青碧", c1: "#D8F5FB", c2: "#A8E7F6", accent: "#06B6D4", deep: "#0E7490" },
];

/**
 * 七类 haikei 风几何纹样。{a}=accent 色、{d}=deep 色。
 * 装饰只压边缘/四角，中央留白给标题。
 */
const MOTIFS = [
  "画面底部三层平滑波浪色带层叠起伏，由 {a} 半透明渐次变淡到 {d}，波浪只占下方三分之一",
  "四角散布大小不一的圆圈，一半是 {a} 空心描边圆环，一半是白色半透明实心圆，越靠角落越大",
  "画面边缘散落若干小三角形并随机旋转，一半 {a} 半透明实心、一半白色空心描边，避开正中央",
  "右上角一组白色半透明平行斜线，左下角一条 {a} 细波浪线穿过，角落再点缀两三个 {d} 小圆点",
  "右上角一大一小两个边缘圆滑的有机斑块，大的用 {a} 半透明、小的用白色半透明，左下角一根 {d} 细弧线呼应",
  "右侧一片由密到疏的圆点阵列（{a} 与白色交替、半透明），向左渐隐消失",
  "底部多条层叠波浪色带（白色、{a} 半透明、{d} 更淡依次交替），如远山层峦，只占下方四分之一",
];

/**
 * 构造「标题海报」式封面提示词。
 *
 * agnes 的图像模型（2.0 / 2.1 / 2.5 flash）都会在画面里渲染文字，
 * 强行要求「无文字」效果很差（会冒出重复或拼错的字母），
 * 因此改为顺水推舟：把文章标题作为画面唯一文字，成品即一张干净的封面卡。
 *
 * 底色与纹样每次随机组合：7 套主题渐变 × 7 类几何纹样 × 4 个渐变方向，
 * 避免全站封面「一个模子」；同一篇重新生成也会换新装。
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

  const pick = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
  const theme = pick(THEMES);
  const motif = pick(MOTIFS).replace(/\{a\}/g, theme.accent).replace(/\{d\}/g, theme.deep);
  const dir = pick(["左上到右下", "右上到左下", "正上到正下", "左下到右上"]);

  const style =
    `以 ${theme.c1} 到 ${theme.c2} 的「${dir}」柔和线性渐变为底色，` +
    `${motif}；` +
    "所有装饰图形均为半透明极简几何元素、不含任何文字，中央区域保持干净留白以突出标题；" +
    "现代扁平插画风格，干净的版面构图，质感高级";

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

  // API Key 优先级：Worker 环境变量 > 站点设置
  let apiKey = "";
  try {
    const ctx = (await getCloudflareContext({
      async: true,
    })) as unknown as { env?: Record<string, unknown> };
    const envKey =
      (typeof ctx.env?.AGNES_API_KEY === "string" && ctx.env.AGNES_API_KEY) ||
      (typeof ctx.env?.AI_COVER_API_KEY === "string" &&
        ctx.env.AI_COVER_API_KEY) ||
      (typeof process.env.AGNES_API_KEY === "string" &&
        process.env.AGNES_API_KEY) ||
      (typeof process.env.AI_COVER_API_KEY === "string" &&
        process.env.AI_COVER_API_KEY);
    if (envKey) apiKey = envKey;
  } catch {
    /* 无绑定时忽略，继续走设置 */
  }

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
