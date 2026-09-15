import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  deletePage,
  getPageById,
  slugExists,
  slugify,
  updatePage,
  type PageInput,
} from "@/lib/pages";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** PUT /api/pages/[id] — 更新页面（需登录） */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "参数不完整" }, { status: 400 });

  const existing = await getPageById(id);
  if (!existing) return NextResponse.json({ error: "页面不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Partial<PageInput> | null;
  if (!body) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });

  const patch: Partial<PageInput> = {};

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    patch.title = t;
  }
  if (body.content !== undefined) patch.content = String(body.content);
  if (body.show_in_nav !== undefined) patch.show_in_nav = body.show_in_nav ? 1 : 0;
  if (body.nav_order !== undefined) patch.nav_order = num(body.nav_order);
  if (body.allow_comments !== undefined) patch.allow_comments = body.allow_comments ? 1 : 0;

  if (body.slug !== undefined) {
    const raw = String(body.slug).trim();
    const slug = raw ? slugify(raw) : slugify(existing.title);
    if (!slug) return NextResponse.json({ error: "URL 路径不合法" }, { status: 400 });
    if (existing.slug === "about" && slug !== "about") {
      return NextResponse.json({ error: "about 页面的 URL 路径不允许修改" }, { status: 403 });
    }
    if (await slugExists(slug, id)) {
      return NextResponse.json({ error: "该 URL 路径已存在" }, { status: 409 });
    }
    patch.slug = slug;
  }

  try {
    await updatePage(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `更新失败：${msg}` }, { status: 500 });
  }
}

/** DELETE /api/pages/[id] — 删除页面（需登录） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "参数不完整" }, { status: 400 });

  const existing = await getPageById(id);
  if (!existing) return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  if (existing.slug === "about") {
    return NextResponse.json({ error: "about 页面不允许删除" }, { status: 403 });
  }

  try {
    await deletePage(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `删除失败：${msg}` }, { status: 500 });
  }
}
