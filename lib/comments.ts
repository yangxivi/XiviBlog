import { getDB } from "./db";

/** 一条留言/评论（前台展示字段） */
export type CommentItem = {
  id: number;
  nickname: string;
  avatar: string;
  content: string;
  created_at: string;
};

export type CommentRow = CommentItem & { page_key: string; ip_hash: string };

/** 合法 page_key：'about'、'post:<数字>' 或自定义页面 'page:<slug>' */
export function isValidPageKey(key: string): boolean {
  return (
    key === "about" ||
    /^post:\d+$/.test(key) ||
    /^page:[\p{L}\p{N}_-]+$/u.test(key)
  );
}

/** 某页面的留言列表（旧的在前，留言板习惯） */
export async function listComments(pageKey: string, limit = 200): Promise<CommentItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT id, nickname, avatar, content, created_at FROM comments WHERE page_key=?1 ORDER BY id ASC LIMIT ?2"
    )
    .bind(pageKey, limit)
    .all<CommentItem>();
  return results ?? [];
}

/** 后台：最新留言（带页面键） */
export async function listRecentComments(limit = 100): Promise<CommentRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT id, page_key, nickname, avatar, content, ip_hash, created_at FROM comments ORDER BY id DESC LIMIT ?1"
    )
    .bind(limit)
    .all<CommentRow>();
  return results ?? [];
}

/** 侧边栏「最新评论」条目：评论 + 它所属的文章/页面 */
export type SidebarComment = {
  id: number;
  nickname: string;
  avatar: string;
  content: string;
  created_at: string;
  /** 评论所在页面标题（文章标题 / 独立页面标题） */
  target: string;
  /** 点击跳转地址（带 #comments 锚点） */
  href: string;
};

/**
 * 侧边栏最新评论：取最近 N 条并解析所属文章 / 独立页面。
 * 关联不到目标（文章已删）的条目直接跳过，保证点得进去。
 */
export async function listSidebarComments(limit = 5): Promise<SidebarComment[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.nickname, c.avatar, c.content, c.created_at, c.page_key,
              p.slug AS post_slug, p.title AS post_title,
              g.slug AS page_slug, g.title AS page_title
         FROM comments c
         LEFT JOIN posts p ON c.page_key = ('post:' || p.id)
         LEFT JOIN pages g
                ON c.page_key = ('page:' || g.slug)
                OR (c.page_key = 'about' AND g.slug = 'about')
        ORDER BY c.id DESC
        LIMIT ?1`
    )
    .bind(Math.min(60, Math.max(1, limit) * 4))
    .all<{
      id: number;
      nickname: string;
      avatar: string;
      content: string;
      created_at: string;
      page_key: string;
      post_slug: string | null;
      post_title: string | null;
      page_slug: string | null;
      page_title: string | null;
    }>();

  const out: SidebarComment[] = [];
  for (const r of results ?? []) {
    let target = "";
    let href = "";
    if (r.post_slug) {
      target = r.post_title || r.post_slug;
      href = `/blog/${r.post_slug}#comments`;
    } else if (r.page_key === "about") {
      target = r.page_title || "关于本站";
      href = "/about#comments";
    } else if (r.page_slug) {
      target = r.page_title || r.page_slug;
      href = `/${r.page_slug}#comments`;
    }
    if (!target || !href) continue;
    out.push({
      id: r.id,
      nickname: r.nickname,
      avatar: r.avatar,
      content: r.content,
      created_at: r.created_at,
      target,
      href,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function countComments(): Promise<number> {
  const db = await getDB();
  const r = await db.prepare("SELECT COUNT(*) AS n FROM comments").first<{ n: number }>();
  return r?.n ?? 0;
}

export async function addComment(
  pageKey: string,
  nickname: string,
  avatar: string,
  content: string,
  ipHash: string
): Promise<CommentItem> {
  const db = await getDB();
  const r = await db
    .prepare(
      "INSERT INTO comments (page_key, nickname, avatar, content, ip_hash) VALUES (?1,?2,?3,?4,?5)"
    )
    .bind(pageKey, nickname, avatar, content, ipHash)
    .run();
  const id = r.meta.last_row_id;
  return {
    id: Number(id),
    nickname,
    avatar,
    content,
    created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}

export async function deleteComment(id: number): Promise<boolean> {
  const db = await getDB();
  const r = await db.prepare("DELETE FROM comments WHERE id=?1").bind(id).run();
  return !!r.meta.changes;
}

/** 同 IP 限频：60 秒内只允许发一条 */
export async function isRateLimited(ipHash: string): Promise<boolean> {
  const db = await getDB();
  const r = await db
    .prepare(
      "SELECT id FROM comments WHERE ip_hash=?1 AND created_at > datetime('now', '-60 seconds') LIMIT 1"
    )
    .bind(ipHash)
    .first();
  return !!r;
}
