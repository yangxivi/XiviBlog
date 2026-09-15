import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createPage, slugExists, slugify, type PageInput } from "@/lib/pages";

/** POST /api/pages — 新建自定义页面（需登录） */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Partial<PageInput> | null;
  if (!body) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });

  const slug = slugify(String(body.slug ?? "").trim() || title);
  if (!slug) return NextResponse.json({ error: "URL 路径不合法" }, { status: 400 });
  if (await slugExists(slug)) {
    return NextResponse.json({ error: "该 URL 路径已存在" }, { status: 409 });
  }

  const input: PageInput = {
    slug,
    title,
    content: String(body.content ?? ""),
    show_in_nav: body.show_in_nav ? 1 : 0,
    nav_order: Number.isFinite(Number(body.nav_order)) ? Number(body.nav_order) : 0,
    allow_comments: body.allow_comments ? 1 : 0,
  };

  try {
    const id = await createPage(input);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `创建失败：${msg}` }, { status: 500 });
  }
}
