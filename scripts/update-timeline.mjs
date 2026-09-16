// 把本次迭代追加到「关于本站」页面的时间轴里。
// 用法：node scripts/update-timeline.mjs
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b433825d809e0bb7e7ba0bb3946ced9f";
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || "0a6dacad-4281-4016-aa90-ce912fe9fa6a";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const date = "2026-09-16";
const heading = "后台体验与首屏收尾";
/** 同一天的小节标题如果改了主题，这里做一次改名（旧 → 新） */
const staleHeadings = [
  "### 2026-09-16｜橱窗卡与设置保存修复",
  "### 2026-09-16｜页眉编辑迁移与设置保存修复",
  "### 2026-09-16｜后台体验与页脚收尾",
];
const bullets = [
  "全站滚动条滑到最底部会自然刹停：页面底边与页脚底边对齐，到底后不会再被拽回去，拖动滚动条不再有跳动",
  "任何页面页脚下方都不再露出空白：页脚永远贴住内容底边；万一有内容（懒加载位移、浏览器扩展后插入的节点等）戳到页脚以下，也会被自动收掉",
  "首页轮播图不再「先虚 3 秒、再变清晰」：打开就是高清大图，图片随页面一起下发，不用等脚本就位后才替换上去",
  "轮播封面改为独立图片地址并按内容指纹长缓存：换封面立刻生效，重复访问直接命中缓存、不再重复下载，首页体积也小了一截",
];

// 任务 C 推翻了任务 B 的两项设计，移除已不准确的时间轴条目
const stalePhrases = ["「编辑页眉」按钮", "「站点设置」可编辑"];

/** 去掉时间轴里逐字重复的条目（多次追加脚本跑出来的重复） */
function dedupeBullets(text) {
  const seen = new Set();
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith("- ")) return true;
      const key = t.replace(/^-\s+/, "").replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

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
  const before = content;

  // 先剔除已被推翻的旧条目，避免时间轴出现互相矛盾的说明
  const lines = content.split("\n").filter((l) => {
    const t = l.replace(/^[-*\s]+/, "");
    return !stalePhrases.some((p) => t.includes(p));
  });
  content = lines.join("\n");

  // 同一天的小节改了主题：把旧标题替换成新标题
  for (const sh of staleHeadings) {
    if (content.includes(sh)) {
      content = content.split(sh).join(`### ${date}｜${heading}`);
    }
  }

  // 清掉逐字重复的条目（多次追加脚本跑出来的重复）
  content = dedupeBullets(content);

  const sectionHeader = `### ${date}`;
  const newSection = `### ${date}｜${heading}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`;

  // 过滤掉已经存在的内容，避免重复追加
  const newBullets = bullets.filter((b) => !content.includes(b));

  // 如果当天已有时间轴条目，追加到该小节；否则在时间轴末尾新建小节
  if (newBullets.length > 0) {
    if (content.includes(sectionHeader)) {
      const idx = content.indexOf(sectionHeader);
      const nextSection = content.indexOf("\n### ", idx + 1);
      const end = nextSection === -1 ? content.indexOf("\n---", idx) : nextSection;
      if (end === -1) {
        console.error("Cannot locate end of current timeline section");
        process.exit(1);
      }
      content =
        content.slice(0, end) +
        "\n" +
        newBullets.map((b) => `- ${b}`).join("\n") +
        content.slice(end);
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
  }

  if (content === before) {
    console.log("No timeline changes.");
    return;
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
