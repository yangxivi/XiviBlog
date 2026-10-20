/**
 * 演示数据种子加载器（自托管版 / Cloudflare 版共用逻辑，SQL 由调用方注入）
 *
 * 为什么用 JSON 而不是 SQL 文件：
 * 文章正文里含有分号（例如 shell 命令 `for f in *.sql; do`），
 * 而安装流程按 `;` 拆分 SQL 语句执行，会把内容从中间切断、导致 SQL 语法错误。
 * 改为 JSON 数据 + 参数化写入（? 占位符），彻底规避转义与拆分问题。
 *
 * 种子内容（用户安装后可在后台自由修改或删除）：
 *   - 站点设置：页脚四栏 / 导航 / 侧边栏橱窗卡 / 公告 / 友情链接 / 页脚二维码 / 关于本站 / 主题
 *   - 文章：183 篇（封面留空，由用户自行上传）
 *   - 页面：关于本站等
 *   - 留言：演示用
 *
 * 幂等：settings.key / posts.slug / pages.slug 唯一，重复执行自动跳过。
 */

export type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tag: string;
  tags: string;
  status: string;
  created_at: string;
  updated_at: string;
  cover_image: string;
  cover_thumb: string;
  pinned: number;
  recommended: number;
  publish_at: string;
};

export type SeedPage = {
  slug: string;
  title: string;
  content: string;
  show_in_nav: number;
  nav_order: number;
  allow_comments: number;
  created_at: string;
  updated_at: string;
  header_title: string;
  header_tagline: string;
  header_desc: string;
};

export type SeedComment = {
  page_key: string;
  nickname: string;
  avatar: string;
  content: string;
  ip_hash: string;
  created_at: string;
};

export type SeedData = {
  settings: Record<string, unknown>;
  posts: SeedPost[];
  pages: SeedPage[];
  comments: SeedComment[];
};

export type SeedResult = {
  settings: boolean;
  posts: number;
  pages: number;
  comments: number;
};
/**
 * 写入种子数据。
 * @param seed 解析好的种子对象
 * @param exec 执行一条 SQL（带 ? 占位符）的函数；返回受影响行数
 */
export async function applySeed(
  seed: SeedData,
  exec: (sql: string, params: unknown[]) => Promise<number>
): Promise<SeedResult> {
  const result: SeedResult = { settings: false, posts: 0, pages: 0, comments: 0 };

  // ---------- 站点设置 ----------
  if (seed.settings && Object.keys(seed.settings).length) {
    const n = await exec(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
      ["site", JSON.stringify(seed.settings)]
    );
    result.settings = n > 0;
  }

  // ---------- 文章 ----------
  for (const p of seed.posts) {
    const n = await exec(
      `INSERT OR IGNORE INTO posts
         (slug, title, excerpt, content, tag, tags, status,
          created_at, updated_at, cover_image, cover_thumb,
          pinned, recommended, publish_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`,
      [
        p.slug, p.title, p.excerpt ?? "", p.content ?? "",
        p.tag ?? "随笔", p.tags ?? "", p.status ?? "published",
        p.created_at, p.updated_at,
        p.cover_image ?? "", p.cover_thumb ?? "",
        p.pinned ?? 0, p.recommended ?? 0, p.publish_at ?? "",
      ]
    );
    result.posts += n;
  }

  // ---------- 页面 ----------
  for (const p of seed.pages) {
    const n = await exec(
      `INSERT OR IGNORE INTO pages
         (slug, title, content, show_in_nav, nav_order, allow_comments,
          created_at, updated_at, header_title, header_tagline, header_desc)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`,
      [
        p.slug, p.title, p.content ?? "",
        p.show_in_nav ?? 0, p.nav_order ?? 0, p.allow_comments ?? 0,
        p.created_at, p.updated_at,
        p.header_title ?? "", p.header_tagline ?? "", p.header_desc ?? "",
      ]
    );
    result.pages += n;
  }

  // ---------- 留言 ----------
  for (const c of seed.comments) {
    const n = await exec(
      `INSERT OR IGNORE INTO comments
         (page_key, nickname, avatar, content, ip_hash, created_at)
       VALUES (?1,?2,?3,?4,?5,?6)`,
      [
        c.page_key, c.nickname, c.avatar ?? "",
        c.content, c.ip_hash ?? "", c.created_at,
      ]
    );
    result.comments += n;
  }

  return result;
}

