import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDB } from "@/lib/db";

/**
 * 批量生成缩略图：只更新 cover_thumb / cover_image 两列，不动正文与版本历史。
 * cover_image 可选——无封面文章生成占位封面时两者一起写。
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: number;
    cover_thumb?: string;
    cover_image?: string;
  } | null;
  if (!body?.id || typeof body.cover_thumb !== "string") {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (body.cover_thumb && !body.cover_thumb.startsWith("data:image/")) {
    return NextResponse.json({ error: "缩略图格式不正确" }, { status: 400 });
  }
  if (
    body.cover_image !== undefined &&
    body.cover_image !== "" &&
    !body.cover_image.startsWith("data:image/")
  ) {
    return NextResponse.json({ error: "封面格式不正确" }, { status: 400 });
  }

  const db = await getDB();
  const r =
    body.cover_image === undefined
      ? await db
          .prepare("UPDATE posts SET cover_thumb=?1 WHERE id=?2")
          .bind(body.cover_thumb, body.id)
          .run()
      : await db
          .prepare("UPDATE posts SET cover_thumb=?1, cover_image=?2 WHERE id=?3")
          .bind(body.cover_thumb, body.cover_image, body.id)
          .run();
  if (!r.meta.changes) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
