import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1";
const DEFAULT_MODEL = "agnes-image-2.0-flash";

/**
 * 编辑器「AI 生图」（正文插图）的参数下发接口。
 *
 * 与 /api/cover（AI 封面）共用同一套 agnes 配置——「站点设置 → AI 封面」里的
 * Key / 模型 / Base URL，不新增任何设置项。
 * 接口要求登录，密钥只返回给已登录的后台用户。
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    prompt?: string;
  } | null;

  if (!body?.prompt?.trim()) {
    return NextResponse.json(
      { error: "请先填写图像描述" },
      { status: 400 }
    );
  }

  // API Key 优先级：环境变量 > 站点设置（自托管走环境变量，与 /api/cover 一致）
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
          "未配置生图 API Key。请在「站点设置 → AI 封面」填入 Key（与 AI 封面共用），或在部署时设置 AGNES_API_KEY 环境变量。",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    endpoint,
    key: apiKey,
    model,
    prompt: body.prompt.trim(),
  });
}
