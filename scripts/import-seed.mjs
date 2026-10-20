#!/usr/bin/env node
/**
 * 导入 XiviBlog 演示数据种子（Cloudflare Workers / D1 版）
 *
 * 用法：
 *   export CLOUDFLARE_API_TOKEN=你的token
 *   export CLOUDFLARE_ACCOUNT_ID=你的account_id
 *   node scripts/import-seed.mjs
 *
 * 作用：把 migrations/_seed_full.json 里的完整演示数据写入 D1——
 *   站点设置（页脚四栏 / 导航 / 侧边栏橱窗 / 公告 / 友情链接 / 页脚二维码 /
 *             关于本站 / 主题）+ 183 篇文章 + 页面 + 留言
 * 导入后用户可在后台自由修改或删除全部内容。
 *
 * 幂等：settings.key / posts.slug / pages.slug 唯一，重复执行自动跳过。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "..", "migrations", "_seed_full.json");

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DB_ID =
  process.env.D1_DATABASE_ID ||
  // 默认读 wrangler.jsonc 里配置的 database_id
  (() => {
    try {
      const raw = readFileSync(
        join(__dirname, "..", "wrangler.jsonc"),
        "utf8"
      );
      const m = raw.match(/"database_id"\s*:\s*"([^"]+)"/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  })();

if (!TOKEN || !ACCOUNT_ID || !DB_ID) {
  console.error("✗ 缺少环境变量：");
  if (!TOKEN) console.error("   CLOUDFLARE_API_TOKEN");
  if (!ACCOUNT_ID) console.error("   CLOUDFLARE_ACCOUNT_ID");
  if (!DB_ID) console.error("   D1_DATABASE_ID（或在 wrangler.jsonc 里配置 database_id）");
  process.exit(1);
}

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;

/** 执行一条带 ?N 占位符的 SQL，返回受影响行数 */
async function exec(sql, params = []) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const j = await res.json();
  if (!j.success) {
    throw new Error(j.errors?.[0]?.message || "D1 执行失败");
  }
  const meta = j.result?.[0]?.meta;
  return Number(meta?.changes ?? 0);
}

const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
console.log("种子文件:", SEED_PATH);
console.log(
  `待导入：文章 ${seed.posts.length} · 页面 ${seed.pages.length} · 留言 ${seed.comments.length}`
);

let settings = 0;
let posts = 0;
let pages = 0;
let comments = 0;

settings = await exec(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
  ["site", JSON.stringify(seed.settings)]
);

for (const p of seed.posts) {
  posts += await exec(
    `INSERT OR IGNORE INTO posts
       (slug, title, excerpt, content, tag, tags, status,
        created_at, updated_at, cover_image, cover_thumb,
        pinned, recommended, publish_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      p.slug, p.title, p.excerpt ?? "", p.content ?? "",
      p.tag ?? "随笔", p.tags ?? "", p.status ?? "published",
      p.created_at, p.updated_at,
      p.cover_image ?? "", p.cover_thumb ?? "",
      p.pinned ?? 0, p.recommended ?? 0, p.publish_at ?? "",
    ]
  );
}

for (const p of seed.pages) {
  pages += await exec(
    `INSERT OR IGNORE INTO pages
       (slug, title, content, show_in_nav, nav_order, allow_comments,
        created_at, updated_at, header_title, header_tagline, header_desc)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      p.slug, p.title, p.content ?? "",
      p.show_in_nav ?? 0, p.nav_order ?? 0, p.allow_comments ?? 0,
      p.created_at, p.updated_at,
      p.header_title ?? "", p.header_tagline ?? "", p.header_desc ?? "",
    ]
  );
}

for (const c of seed.comments) {
  comments += await exec(
    `INSERT OR IGNORE INTO comments
       (page_key, nickname, avatar, content, ip_hash, created_at)
     VALUES (?,?,?,?,?,?)`,
    [
      c.page_key, c.nickname, c.avatar ?? "",
      c.content, c.ip_hash ?? "", c.created_at,
    ]
  );
}

console.log("\n✓ 导入完成：");
console.log(`  站点设置 ${settings ? "已写入" : "已存在（跳过）"}`);
console.log(`  文章 ${posts} 篇`);
console.log(`  页面 ${pages} 个`);
console.log(`  留言 ${comments} 条`);
console.log("\n现在可以访问站点查看效果；所有内容都可在后台自行修改或删除。");
