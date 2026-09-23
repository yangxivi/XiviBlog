import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getById, getDB, normPublishAt, snapshotRevision, type SnapshotSource } from "@/lib/db";

type PostBody = {
  title?: string;
  excerpt?: string;
  cover_image?: string;
  /** 封面缩略图（320px 小图 base64），列表/侧栏用；与 cover_image 一起提交 */
  cover_thumb?: string;
  content?: string;
  tag?: string;
  tags?: string;
  status?: string;
  pinned?: boolean | number;
  publish_at?: string;
  /** true = 来自 3 秒防抖的自动保存，版本历史会把它合并进当前会话 */
  auto?: boolean;
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const post = await getById(Number(id));
  if (!post) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }

  const db = await getDB();
  const next = {
    title: body.title.trim(),
    excerpt: body.excerpt?.trim() ?? post.excerpt,
    cover_image: body.cover_image?.trim() ?? post.cover_image,
    cover_thumb: body.cover_thumb?.trim() ?? post.cover_thumb,
    content: body.content ?? post.content,
    tag: body.tag?.trim() || post.tag,
    tags: body.tags === undefined ? post.tags : body.tags?.trim() ?? "",
    status: (body.status === "published" ? "published" : "draft") as string,
    pinned: body.pinned === undefined ? post.pinned : body.pinned ? 1 : 0,
    publish_at:
      body.publish_at === undefined ? post.publish_at : normPublishAt(body.publish_at),
  };

  await db
    .prepare(
      "UPDATE posts SET title=?1, excerpt=?2, cover_image=?3, cover_thumb=?4, content=?5, tag=?6, tags=?7, status=?8, pinned=?9, publish_at=?10 WHERE id=?11"
    )
    .bind(
      next.title,
      next.excerpt,
      next.cover_image,
      next.cover_thumb,
      next.content,
      next.tag,
      next.tags,
      next.status,
      next.pinned,
      next.publish_at,
      post.id
    )
    .run();

  // 每次保存都留一版；自动保存（auto=true）会与同一写作会话内的版本合并
  const isAuto = body.auto === true;
  const revInput: SnapshotSource = {
    id: post.id,
    title: next.title,
    excerpt: next.excerpt,
    content: next.content,
    cover_image: next.cover_image,
    tag: next.tag,
    status: next.status,
  };
  const revId = await snapshotRevision(
    revInput,
    isAuto ? "" : next.status === "published" ? "发布" : "保存草稿",
    isAuto
  );

  return NextResponse.json({ ok: true, revision: revId });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDB();
  await db.prepare("DELETE FROM posts WHERE id=?1").bind(Number(id)).run();
  return NextResponse.json({ ok: true });
}
