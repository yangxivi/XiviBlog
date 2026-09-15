import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { listRollbackBundles } from "@/lib/updater";
import { restoreSnapshot } from "@/lib/snapshot";
import { getUpdateJob, writeUpdateJob } from "@/lib/updater";

export const dynamic = "force-dynamic";

/** 列出可回滚的源码备份 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return NextResponse.json({ bundles: listRollbackBundles() });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    file?: string;
    snapshotId?: number;
  } | null;

  const file = (body?.file || "").trim();
  if (!file || !existsSync(file)) {
    return NextResponse.json({ error: "未指定合法的回滚备份文件" }, { status: 400 });
  }

  // 1) 若指定了数据快照，先在应用存活时恢复（代码回滚会重启进程，无法再写库）
  let restoredSnapshot = false;
  if (body?.snapshotId) {
    try {
      await restoreSnapshot(body.snapshotId, { mode: "replace", withSettings: true });
      restoredSnapshot = true;
    } catch (e) {
      return NextResponse.json(
        { error: `数据快照恢复失败：${e instanceof Error ? e.message : e}` },
        { status: 500 }
      );
    }
  }

  // 2) 记录回滚任务并派生 detached 脚本：解包源码备份 → 重建 → 重启
  const job = getUpdateJob();
  job.status = "rolled_back";
  job.finishedAt = new Date().toISOString();
  job.log.push(`开始回滚到源码备份：${file}${restoredSnapshot ? "（含数据快照恢复）" : ""}`);
  writeUpdateJob(job);

  try {
    const script = join(process.cwd(), "scripts", "self-rollback.cjs");
    const child = spawn("node", [script], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ROLLBACK_FILE: file },
    });
    child.unref();
  } catch (e) {
    return NextResponse.json(
      { error: `启动回滚进程失败：${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, restoredSnapshot, job });
}
