import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { checkUpdate } from "@/lib/updater";

export const dynamic = "force-dynamic";

/** 检查是否有可用更新 */
export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const check = await checkUpdate();
    return NextResponse.json(check);
  } catch (e) {
    return NextResponse.json(
      { current: "1.3.19", latest: null, hasUpdate: false, error: e instanceof Error ? e.message : "检查失败" },
      { status: 500 }
    );
  }
}
