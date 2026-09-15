import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listAll,
  listPublished,
  listPublishedPage,
  countPublished,
  getById,
  getBySlug,
  getDB,
  normPublishAt,
  snapshotRevision,
} from "@/lib/db";

function slugify(title: string): string {
  const t = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return t || `post-${Date.now()}`;
}

type PostBody = {
  title?: string;
  slug?: string;
  excerpt?: string;
  cover_image?: string;
  /** 封面缩略图（320px 小图 base64），列表/侧栏用 */
  cover_thumb?: string;
  content?: string;
  tag?: string;
  tags?: string;
  status?: string;
  pinned?: boolean | number;
  /** UTC 'YYYY-MM-DD HH:MM:SS'，空串 = 立即发布 */
  publish_at?: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const id = searchParams.get("id");
  const slug = searchParams.get("slug");
  const page = searchParams.get("page");
  const size = searchParams.get("size");
  const tag = searchParams.get("tag");
  const year = searchParams.get("year");

  // 分页模式：列表页客户端翻页按需拉取（只返回一页 + 总数）
  if (page || size) {
    const p = Math.max(1, parseInt(page || "1", 10) || 1);
    const s = Math.min(50, Math.max(1, parseInt(size || "30", 10) || 30));
    const offset = (p - 1) * s;
    const [posts, total] = await Promise.all([
      listPublishedPage(s, offset, tag || undefined, year || undefined),
      countPublished(tag || undefined, year || undefined),
    ]);
    return NextResponse.json({ posts, total });
  }

  if (scope === "all") {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ posts: await listAll() });
  }
  if (id) {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const post = await getById(Number(id));
    if (!post) return NextResponse.json({ error: "不存在" }, { status: 404 });
    return NextResponse.json({ post });
  }
  if (slug) {
    const post = await getBySlug(slug, await isAuthenticated());
    if (!post) return NextResponse.json({ error: "不存在" }, { status: 404 });
    return NextResponse.json({ post });
  }
  return NextResponse.json({ posts: await listPublished() });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }

  const db = await getDB();
  let slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.title);
  const exists = await db
    .prepare("SELECT id FROM posts WHERE slug=?1")
    .bind(slug)
    .first();
  if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const r = await db
    .prepare(
      "INSERT INTO posts (slug, title, excerpt, cover_image, cover_thumb, content, tag, tags, status, pinned, publish_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)"
    )
    .bind(
      slug,
      body.title.trim(),
      body.excerpt?.trim() || "",
      body.cover_image?.trim() || "",
      body.cover_thumb?.trim() || "",
      body.content || "",
      body.tag?.trim() || "随笔",
      body.tags?.trim() || "",
      body.status === "published" ? "published" : "draft",
      body.pinned ? 1 : 0,
      normPublishAt(body.publish_at)
    )
    .run();

  // 版本历史的起点：新建时存一版，之后每次改动都有对比基准
  const newId = r.meta.last_row_id;
  if (newId) {
    await snapshotRevision(
      {
        id: newId,
        title: body.title.trim(),
        excerpt: body.excerpt?.trim() || "",
        content: body.content || "",
        cover_image: body.cover_image?.trim() || "",
        tag: body.tag?.trim() || "随笔",
        status: body.status === "published" ? "published" : "draft",
      },
      "创建文章",
      false
    );
  }

  return NextResponse.json({ ok: true, id: newId, slug });
}
