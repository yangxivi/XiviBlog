import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  deleteRevision,
  getById,
  getRevision,
  getDB,
  snapshotRevision,
} from "@/lib/db";

type Ctx = { params: Promise<{ id: string; revId: string }> };

/** 取单个版本的完整内容（预览用） */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { revId } = await params;
  const rev = await getRevision(Number(revId));
  if (!rev) return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  return NextResponse.json({ ok: true, revision: rev });
}

/**
 * 恢复到这个版本。
 * 恢复前会把「当前状态」先存成一个版本（note 说明来源），
 * 所以误点恢复也能再退回去 —— 版本历史不会因为恢复而丢东西。
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, revId } = await params;
  const post = await getById(Number(id));
  if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

  const rev = await getRevision(Number(revId));
  if (!rev || rev.post_id !== post.id) {
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  }

  // 先把当前状态存档，保证「恢复」这个动作本身可撤销
  await snapshotRevision(post, `恢复前备份（${rev.created_at}）`, false);

  const db = await getDB();
  await db
    .prepare(
      "UPDATE posts SET title=?1, excerpt=?2, content=?3, cover_image=?4, tag=?5, status=?6 WHERE id=?7"
    )
    .bind(
      rev.title,
      rev.excerpt,
      rev.content,
      rev.cover_image,
      rev.tag,
      rev.status === "published" ? "published" : "draft",
      post.id
    )
    .run();

  return NextResponse.json({
    ok: true,
    revision: rev,
  });
}

/** 删除单个版本 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { revId } = await params;
  const ok = await deleteRevision(Number(revId));
  if (!ok) return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
