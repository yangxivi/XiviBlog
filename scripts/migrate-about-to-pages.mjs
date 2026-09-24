/**
 * 把「关于本站」从 settings 表迁移到 pages 表。
 * 运行方式：node scripts/migrate-about-to-pages.mjs
 *
 * 逻辑：
 * 1. 读取 settings.site 的 aboutTitle / aboutContent
 * 2. 若 pages 表没有 slug='about'，则插入
 * 3. 若已存在，则更新 title/content（保留原有 show_in_nav / nav_order / allow_comments）
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b433825d809e0bb7e7ba0bb3946ced9f";
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || "0a6dacad-4281-4016-aa90-ce912fe9fa6a";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!API_TOKEN) {
  console.error("ERROR: 请先设置环境变量 CLOUDFLARE_API_TOKEN（具备 D1 编辑权限的 Cloudflare API Token）");
  process.exit(1);
}

const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

async function d1Query(sql, params = []) {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const j = await res.json();
  if (!j.success) {
    const errs = Array.isArray(j.errors) ? j.errors.map((e) => e.message).join("; ") : JSON.stringify(j);
    throw new Error(`D1 query failed: ${errs}`);
  }
  return j.result?.[0] ?? j.result;
}

async function main() {
  if (!API_TOKEN) {
    console.error("错误：请先设置环境变量 CLOUDFLARE_API_TOKEN");
    process.exit(1);
  }
  // 1. 读取 settings 里的关于页内容
  const settingsRes = await d1Query("SELECT value FROM settings WHERE key=?1", ["site"]);
  const row = settingsRes.results?.[0];
  let aboutTitle = "关于这个博客";
  let aboutContent = "";
  if (row?.value) {
    try {
      const s = JSON.parse(row.value);
      if (s.aboutTitle) aboutTitle = String(s.aboutTitle);
      if (s.aboutContent) aboutContent = String(s.aboutContent);
    } catch {
      /* 解析失败就用默认值 */
    }
  }
  console.log("settings aboutTitle:", aboutTitle);
  console.log("settings aboutContent length:", aboutContent.length);

  // 2. 检查 pages 是否已有 about
  const pageRes = await d1Query("SELECT id, show_in_nav, nav_order, allow_comments FROM pages WHERE slug=?1", ["about"]);
  const existing = pageRes.results?.[0];

  if (existing) {
    // 保留原导航/留言开关，只更新标题与正文
    await d1Query(
      "UPDATE pages SET title=?1, content=?2, updated_at=datetime('now') WHERE slug=?3",
      [aboutTitle, aboutContent, "about"]
    );
    console.log(`已更新 pages id=${existing.id} slug=about`);
  } else {
    await d1Query(
      "INSERT INTO pages (slug, title, content, show_in_nav, nav_order, allow_comments) VALUES (?1,?2,?3,?4,?5,?6)",
      ["about", aboutTitle, aboutContent, 0, 0, 1]
    );
    console.log("已插入 pages slug=about");
  }

  // 3. 验证
  const verifyRes = await d1Query("SELECT id, slug, title, length(content) AS content_len FROM pages WHERE slug=?1", ["about"]);
  console.log("verify:", verifyRes.results?.[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
