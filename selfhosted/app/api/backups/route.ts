import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  createSnapshot,
  getSnapshotStats,
  listSnapshots,
} from "@/lib/snapshot";
import { listJobStatus } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/** 快照列表 + 统计 + 定时任务状态（备份页一次拿全） */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const [snapshots, stats, jobs] = await Promise.all([
    listSnapshots(30),
    getSnapshotStats(),
    listJobStatus(),
  ]);
  return NextResponse.json({ ok: true, snapshots, stats, jobs });
}

/** 手动打一份快照 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    note?: string;
  } | null;

  if (body?.action !== "create") {
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }

  try {
    const note = (body.note || "").trim().slice(0, 60) || "手动备份";
    const r = await createSnapshot("manual", note);
    const [snapshots, stats] = await Promise.all([
      listSnapshots(30),
      getSnapshotStats(),
    ]);
    return NextResponse.json({ ok: true, created: r, snapshots, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `备份失败：${msg}` }, { status: 500 });
  }
}
