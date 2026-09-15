import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { readDeployedVersion } from "@/lib/updater";

export const dynamic = "force-dynamic";

/** 公开：返回当前运行版本（更新脚本用它校验是否更新成功） */
export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    deployed: readDeployedVersion(),
    selfHosted: true,
    node: process.version,
  });
}
