// 把本次迭代追加到「关于本站」页面的时间轴里。
// 用法：node scripts/update-timeline.mjs
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b433825d809e0bb7e7ba0bb3946ced9f";
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || "0a6dacad-4281-4016-aa90-ce912fe9fa6a";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const date = "2026-09-16";
const heading = "页眉编辑迁移与设置保存修复";
const bullets = [
  "去掉自定义页面与关于页横幅右上角的「编辑页眉」按钮，页眉编辑直接融入页面编辑器（页面标题下方），编辑页面即编辑页眉",
  "页眉文案（大标题 / 标语 / 描述）从「站点设置」迁移到「页面编辑器」，每页独立维护，关于页也走页面记录，存入 pages 表 header_title / header_tagline / header_desc",
  "后台保存设置失败时顶部悬浮红色横幅提示，并明确「登录已过期」等错误，内容不丢失可直接重试",
  "侧边栏橱窗卡上传图片后不再叠加左上角 XIVI 黑字水印，宣传图保持原样",
  "橱窗图上传压缩优化为 640px WebP，体积约为原来的 1/4，页面加载更快",
  "修复后台保存设置会把 AI 封面密钥覆盖成脱敏值导致 AI 封面失效的问题",
];

// 任务 C 推翻了任务 B 的两项设计，移除已不准确的时间轴条目
const stalePhrases = ["「编辑页眉」按钮", "「站点设置」可编辑"];

async function main() {
  if (!TOKEN) {
    console.error("Missing CLOUDFLARE_API_TOKEN");
    process.exit(1);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

  // 1) 读取当前 about 内容
  const readRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql: "SELECT id, content FROM pages WHERE slug=?1",
      params: ["about"],
    }),
  });
  const readData = await readRes.json();
  if (!readRes.ok || !readData.success) {
    console.error("D1 read failed:", JSON.stringify(readData, null, 2));
    process.exit(1);
  }
  const row = readData.result[0]?.results[0];
  if (!row) {
    console.error("about page not found");
    process.exit(1);
  }

  let content = row.content;
  // 先剔除已被推翻的旧条目，避免时间轴出现互相矛盾的说明
  const lines = content.split("\n").filter((l) => {
    const t = l.replace(/^[-*\s]+/, "");
    return !stalePhrases.some((p) => t.includes(p));
  });
  content = lines.join("\n");
  const sectionHeader = `### ${date}`;
  const newSection = `### ${date}｜${heading}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`;

  // 过滤掉已经存在的内容，避免重复追加
  const newBullets = bullets.filter((b) => !content.includes(b));
  if (newBullets.length === 0) {
    console.log("No new timeline entries to add.");
    return;
  }

  // 如果当天已有时间轴条目，追加到该小节；否则在时间轴末尾新建小节
  if (content.includes(sectionHeader)) {
    const idx = content.indexOf(sectionHeader);
    const nextSection = content.indexOf("\n### ", idx + 1);
    const end = nextSection === -1 ? content.indexOf("\n---", idx) : nextSection;
    if (end === -1) {
      console.error("Cannot locate end of current timeline section");
      process.exit(1);
    }
    content = content.slice(0, end) + "\n" + newBullets.map((b) => `- ${b}`).join("\n") + content.slice(end);
  } else {
    const marker = "## 迭代时间轴";
    const idx = content.indexOf(marker);
    if (idx === -1) {
      console.error("Timeline marker not found");
      process.exit(1);
    }
    const insertAt = idx + marker.length;
    content = content.slice(0, insertAt) + "\n\n" + newSection + content.slice(insertAt);
  }

  // 3) 写回 pages 表
  const writeRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql: "UPDATE pages SET content=?1, updated_at=datetime('now') WHERE id=?2",
      params: [content, row.id],
    }),
  });
  const writeData = await writeRes.json();
  if (!writeRes.ok || !writeData.success) {
    console.error("D1 write failed:", JSON.stringify(writeData, null, 2));
    process.exit(1);
  }
  console.log("Timeline updated successfully.");
}

main();
