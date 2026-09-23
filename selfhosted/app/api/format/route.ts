import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_MODEL = "glm-4.7-flash";

/**
 * AI 自动排版接口。
 * 根据文章内容，调用文本大模型按曦微风格格式化 Markdown。
 * - 一级标题 (#) → h2
 * - 二级标题 (##) → h3
 * - 强引用 (>>>) → blockquote
 * - 分割线 (---) → <hr>
 * - 强调标签 → <strong>
 * - 代码块保持原样
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
  } | null;

  if (!body?.content?.trim()) {
    return NextResponse.json(
      { error: "请先填写文章内容" },
      { status: 400 }
    );
  }

  // 获取 API 配置（直接使用环境变量，无需 Cloudflare Context）
  let resolvedApiKey = process.env.AI_FORMAT_API_KEY || "";

  const settings = await getSettings();
  if (!resolvedApiKey) resolvedApiKey = settings.aiFormatApiKey || settings.aiCoverApiKey || "";

  const model = settings.aiFormatModel?.trim() || DEFAULT_MODEL;
  const baseUrl = settings.aiFormatBaseUrl?.trim() || DEFAULT_BASE_URL;

  if (!resolvedApiKey) {
    return NextResponse.json(
      {
        error: "未配置 AI 排版 API Key。请在「站点设置 → AI 排版」填入 Key。",
      },
      { status: 400 }
    );
  }

  // 构造提示词
  const prompt = `你是一个专业的博客文章排版助手。请将以下 Markdown 内容按照曦微博客风格进行自动排版。

排版规则：
1. 文章主标题使用 # 开头（会渲染为 h2）
2. 一级小节标题使用 ## 开头（会渲染为 h3）
3. 二级小节标题使用 ### 开头（会渲染为 h4）
4. 引用内容使用 > 开头，重要提示使用 >> 开头
5. 分割线使用 --- 或 ***
6. 强调内容使用 **粗体**
7. 代码块使用 三个反引号 包裹
8. 列表使用 - 或 1. 2. 3.
9. 链接使用 [text](url)
10. 保持内容完整，不要删减信息

请只输出排版后的 Markdown 内容，不要添加任何解释。

文章标题：${body.title || "未命名"}

文章内容：
${body.content}`;

  // 调用 LLM API
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resolvedApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "你是一个专业的 Markdown 排版助手。" },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `API 调用失败 ${response.status}: ${error.slice(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const formattedContent = data.choices?.[0]?.message?.content?.trim() || body.content;

    return NextResponse.json({
      ok: true,
      content: formattedContent,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `请求失败: ${e instanceof Error ? e.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
