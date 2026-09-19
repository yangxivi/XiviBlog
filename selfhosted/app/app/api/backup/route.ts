import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { importBackup } from "@/lib/backup-import";
import { collectBackup } from "@/lib/snapshot";
import type { BackupFile } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** 导出：全部文章 + 站点设置（快照的下载接口复用 lib/snapshot 的同一份组装逻辑） */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const payload = await collectBackup();
  const stamp = new Date(Date.now() + 8 * 3600_000)
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="xivi-blog-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

type ImportBody = {
  /** merge = 按 slug 覆盖/新增；replace = 先清空再导入 */
  mode?: "merge" | "replace";
  /** 是否一并恢复站点设置 */
  withSettings?: boolean;
  data?: BackupFile;
};

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ImportBody | null;
  const data = body?.data;
  if (!data || !Array.isArray(data.posts)) {
    return NextResponse.json({ error: "备份文件格式不正确" }, { status: 400 });
  }

  try {
    const r = await importBackup(data, {
      mode: body?.mode === "replace" ? "replace" : "merge",
      withSettings: body?.withSettings,
    });
    return NextResponse.json({
      ok: true,
      mode: r.mode,
      inserted: r.inserted,
      updated: r.updated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `导入失败：${msg}` }, { status: 500 });
  }
}
