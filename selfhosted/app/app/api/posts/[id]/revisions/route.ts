import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getById, listRevisions, snapshotRevision } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** 列出某篇文章的版本（不含正文） */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, revisions: await listRevisions(postId) });
}

/** 手动打一个版本快照，note 用来自我说明（例如「改版前存档」） */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const post = await getById(Number(id));
  if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const note = (body?.note ?? "").trim().slice(0, 40) || "手动存档";

  const revId = await snapshotRevision(post, note, false);
  if (revId === null) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "内容与最新版本一致，无需存档",
    });
  }
  return NextResponse.json({ ok: true, id: revId });
}
