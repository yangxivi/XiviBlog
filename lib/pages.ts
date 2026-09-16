import { getDB } from "./db";

/**
 * 自定义页面（站长的「页面」系统）。
 * 用于拓展博客：留言板、友链页、单页说明等独立页面，区别于按时间排序的文章。
 * 页面可通过 show_in_nav 出现在顶部导航，allow_comments 决定是否挂留言区。
 */
export type PageRow = {
  id: number;
  slug: string;
  title: string;
  content: string;
  /** 1 = 在顶部导航显示 */
  show_in_nav: number;
  /** 导航排序，越小越靠前 */
  nav_order: number;
  /** 1 = 允许留言评论 */
  allow_comments: number;
  /** 页眉大标题（留空前台回退页面标题；about 页回退站点名） */
  header_title: string;
  /** 页眉第二行标语（留空隐藏） */
  header_tagline: string;
  /** 页眉第三行描述（留空隐藏） */
  header_desc: string;
  created_at: string;
  updated_at: string;
};

/** 新建/更新时由调用方提供的字段 */
export type PageInput = {
  slug: string;
  title: string;
  content: string;
  show_in_nav: number;
  nav_order: number;
  allow_comments: number;
  header_title?: string;
  header_tagline?: string;
  header_desc?: string;
};

/** 全是已发布文章列表查询，失败就回退空数组，绝不让页面崩 */
export async function listPages(): Promise<PageRow[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare("SELECT * FROM pages ORDER BY nav_order ASC, id ASC")
      .all<PageRow>();
    return results ?? [];
  } catch {
    return [];
  }
}

/** 仅返回需要进导航的页面（按 nav_order 排），供 layout 注入顶部导航 */
export async function listNavPages(): Promise<PageRow[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        "SELECT * FROM pages WHERE show_in_nav=1 ORDER BY nav_order ASC, id ASC"
      )
      .all<PageRow>();
    return results ?? [];
  } catch {
    return [];
  }
}

export async function getPageBySlug(slug: string): Promise<PageRow | null> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT * FROM pages WHERE slug=?1")
      .bind(slug)
      .first<PageRow>();
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getPageById(id: number): Promise<PageRow | null> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT * FROM pages WHERE id=?1")
      .bind(id)
      .first<PageRow>();
    return row ?? null;
  } catch {
    return null;
  }
}

/** 检查 slug 是否已被占用（编辑时排除自身） */
export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  try {
    const db = await getDB();
    const row = exceptId
      ? await db
          .prepare("SELECT 1 FROM pages WHERE slug=?1 AND id<>?2")
          .bind(slug, exceptId)
          .first()
      : await db.prepare("SELECT 1 FROM pages WHERE slug=?1").bind(slug).first();
    return !!row;
  } catch {
    return false;
  }
}

export async function createPage(p: PageInput): Promise<number> {
  const db = await getDB();
  const r = await db
    .prepare(
      "INSERT INTO pages (slug, title, content, show_in_nav, nav_order, allow_comments, header_title, header_tagline, header_desc) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)"
    )
    .bind(
      p.slug,
      p.title,
      p.content,
      p.show_in_nav,
      p.nav_order,
      p.allow_comments,
      p.header_title ?? "",
      p.header_tagline ?? "",
      p.header_desc ?? ""
    )
    .run();
  return r.meta.last_row_id ?? 0;
}

export async function updatePage(id: number, p: Partial<PageInput>): Promise<void> {
  const db = await getDB();
  const sets: string[] = [];
  const binds: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => {
    sets.push(`${col}=?${i}`);
    binds.push(val);
    i++;
  };
  if (p.slug !== undefined) add("slug", p.slug);
  if (p.title !== undefined) add("title", p.title);
  if (p.content !== undefined) add("content", p.content);
  if (p.show_in_nav !== undefined) add("show_in_nav", p.show_in_nav);
  if (p.nav_order !== undefined) add("nav_order", p.nav_order);
  if (p.allow_comments !== undefined) add("allow_comments", p.allow_comments);
  if (p.header_title !== undefined) add("header_title", p.header_title);
  if (p.header_tagline !== undefined) add("header_tagline", p.header_tagline);
  if (p.header_desc !== undefined) add("header_desc", p.header_desc);
  if (!sets.length) return;
  binds.push(id);
  await db
    .prepare(`UPDATE pages SET ${sets.join(",")}, updated_at=datetime('now') WHERE id=?${i}`)
    .bind(...(binds as (string | number)[]))
    .run();
}

export async function deletePage(id: number): Promise<void> {
  const db = await getDB();
  await db.prepare("DELETE FROM pages WHERE id=?1").bind(id).run();
}

/** 把标题/任意串规范成 URL 友好的 slug：小写、保留中文与字母数字与连字符 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
