import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings, saveSettings, type SiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function redactForPublic(settings: SiteSettings): SiteSettings {
  // 公开读取时不要把敏感 API Key 暴露给匿名访客
  return { ...settings, aiCoverApiKey: settings.aiCoverApiKey ? "***" : "" };
}

/** 读取站点设置（公开，前台也可用；敏感字段会脱敏） */
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings: redactForPublic(settings) });
}

/** 保存站点设置（需登录） */
async function save(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }
  try {
    const settings = await saveSettings(body);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `保存失败：${msg}` }, { status: 500 });
  }
}

export const PUT = save;
export const POST = save;
