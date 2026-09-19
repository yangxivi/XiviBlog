import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  deleteSnapshot,
  getSnapshotData,
  restoreSnapshot,
} from "@/lib/snapshot";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 把某份快照下载成标准备份文件（与「下载备份文件」导出格式完全一致，可互换使用） */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: "ID 不合法" }, { status: 400 });
  }

  const data = await getSnapshotData(n);
  if (!data) return NextResponse.json({ error: "快照不存在" }, { status: 404 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="xivi-snapshot-${n}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/** 从快照恢复 */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: "ID 不合法" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    mode?: "merge" | "replace";
    withSettings?: boolean;
  } | null;

  try {
    const r = await restoreSnapshot(n, {
      mode: body?.mode === "replace" ? "replace" : "merge",
      withSettings: body?.withSettings === true,
    });
    return NextResponse.json({
      ok: true,
      inserted: r.inserted,
      updated: r.updated,
      mode: r.mode,
      settingsRestored: r.settingsRestored,
      safetySnapshotId: r.safetySnapshotId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `恢复失败：${msg}` }, { status: 500 });
  }
}

/** 删除一份快照 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: "ID 不合法" }, { status: 400 });
  }
  const ok = await deleteSnapshot(n);
  return NextResponse.json({ ok });
}
