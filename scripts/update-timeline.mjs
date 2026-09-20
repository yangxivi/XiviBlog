// 把本次迭代追加到「关于本站」页面的时间轴里。
// 用法：
//   node scripts/update-timeline.mjs            追加/改名/去重（会写 D1）
//   node scripts/update-timeline.mjs --audit    只体检：列出疑似「同一件事写了多次」的条目，不写库
// 需 CLOUDFLARE_API_TOKEN（写入时）。
//
// 排序约定：时间轴小节按**升序**排（09-09 → 09-10 → … → 最新一天在最后）。
// 当天小节已存在 → 往该小节里追加；不存在 → 在整段**末尾**新建小节。详见下方 else 分支注释。
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b433825d809e0bb7e7ba0bb3946ced9f";
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || "0a6dacad-4281-4016-aa90-ce912fe9fa6a";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const date = "2026-09-20";
const heading = "后台 UI 优化与迭代时间轴更新";
/** 同一天的小节标题如果改了主题，这里做一次改名（旧 → 新） */
const staleHeadings = ["### 2026-09-17｜滚动到底与页脚贴合修复"];
const bullets = ["后台侧边栏品牌区 + 所有 15 个 panel 页面 sticky title bar 高度统一为 h-14 (56px) + flex items-center","所有图标统一 h-4 w-4","收起菜单/退出登录按钮改为 text-white font-bold text-xs","退出登录：POST /api/auth/logout 后跳转 /admin/login","侧边栏内边距缩减（品牌区 px-3→px-2、导航 px-3→px-2、底部 p-3→p-2）让左右留白均衡","CF 部署版本：2222043d-d6bd-48df-bd63-ad95611aee09",];

const stalePhrases = [
  // 09-17 当天被后续实现推翻的旧描述（留着会与最终说明矛盾）
  "侧栏在左时整体自动右移一个侧栏宽度",
  "悬停与选中行的背景色改用主题色浅底",
];

/**
 * 归一化一个条目：剥掉空白与常见中英标点，只留实义字符。
 * 用途有两个：① 去重时当 key；② 审计时算相似度。
 */
const normBullet = (s) =>
  s
    .replace(/^-\s+/, "")
    .replace(/[\s、，,。：:；;「」『』（）()【】\[\]\-·—…~!！?？"'"'*#/]/g, "");

/**
 * 去掉时间轴里重复的条目（保留首次出现的那条）。
 *
 * ⚠️ 这里只做「归一化后完全相同」的保守去重 —— 它只能收掉纯标点/空格差异，
 * 收不掉真正的麻烦：同一件事被反复追加、但每次措辞都换了一点（例如
 * 「白底灰描边」「白底主题色描边」「白底描边」其实是一件事）。
 * 那种要靠 auditSimilar() 报出来人工合并，不能自动删 —— 自动删会误伤
 * 「今天修了 A，后来又把 A 修了一遍」这类正常记录。
 */
function dedupeBullets(text) {
  const seen = new Set();
  const dropped = [];
  const out = text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith("- ")) return true;
      const key = normBullet(t);
      if (seen.has(key)) {
        dropped.push(t.slice(2, 42));
        return false;
      }
      seen.add(key);
      return true;
    })
    .join("\n");
  if (dropped.length) {
    console.log(`时间轴去重：移除 ${dropped.length} 条重复条目`);
    for (const d of dropped) console.log(`  - ${d}…`);
  }
  return out;
}

/**
 * 审计：把「疑似同一件事写了多次」的条目列出来供人工合并，**不自动删**。
 *
 * 判据（满足其一即报）：
 *   ① 归一化后共同前缀 ≥ 15 字 —— 开头整句都一样，基本可以断定是同一件事；
 *   ② 去重字符集 Jaccard 相似度 ≥ 0.75 —— 换了措辞但用词高度重合。
 * 阈值的来历：拿 09-16 那份攒了 4 组的原文实测过，前缀≥5 字会报 8 对
 * （「侧栏「推荐阅读」…」「封面/缩略图…」这类同主题不同事的正常条目全被误报），
 * 收紧到上面两个值正好只报该报的 4 组、零误报。**别再往回放松。**
 *
 * 每条都会标出所在小节，且区分「同小节」「跨小节」——**跨小节的命中多数不用管**：
 * 「## 主要功能 → ### 评论系统」里的功能说明和「## 迭代时间轴」里那天新增该功能的
 * 记录本来就该各有一条，措辞撞车是正常的。真正要合并的基本都在同一小节里。
 */
function auditSimilar(text) {
  const rows = [];
  let section = "";
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("### ") || t.startsWith("## ")) {
      section = t.replace(/^#+\s*/, "");
      continue;
    }
    if (t.startsWith("- ")) rows.push({ text: t.slice(2), section });
  }

  const pairs = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = normBullet(rows[i].text);
      const b = normBullet(rows[j].text);
      if (!a || !b) continue;
      let p = 0;
      while (p < a.length && p < b.length && a[p] === b[p]) p++;
      const sa = new Set(a);
      const sb = new Set(b);
      let inter = 0;
      for (const c of sa) if (sb.has(c)) inter++;
      const jac = inter / (sa.size + sb.size - inter);
      if (p >= 15 || jac >= 0.75) {
        pairs.push({
          i: i + 1,
          j: j + 1,
          a: rows[i],
          b: rows[j],
          p,
          jac,
          same: rows[i].section === rows[j].section,
        });
      }
    }
  }

  const same = pairs.filter((r) => r.same);
  console.log(`\n时间轴相似条目审计：共 ${rows.length} 条`);
  console.log(`  同小节命中 ${same.length} 对（基本都该合并）`);
  console.log(`  跨小节命中 ${pairs.length - same.length} 对（多半是「功能说明 vs 时间轴」的正常重复，看看即可）`);
  if (!pairs.length) console.log("  ✓ 没有需要人工处理的条目");
  for (const r of pairs.sort((x, y) => Number(y.same) - Number(x.same))) {
    console.log(`\n  ${r.same ? "★ 同小节" : "  跨小节"} [${r.i} ↔ ${r.j}] 前缀${r.p}字/相似度${r.jac.toFixed(2)}`);
    console.log(`      A（${r.a.section}）: ${r.a.text}`);
    console.log(`      B（${r.b.section}）: ${r.b.text}`);
  }
  return pairs;
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

  // --audit：只体检不写入。时间轴会随迭代不断追加条目，同一件事换措辞写第二遍
  // 时不会逐字重复、去重抓不到，所以要定期跑一次审计、人工合并。
  if (process.argv.includes("--audit")) {
    auditSimilar(content);
    console.log("\n（--audit 只读不写，未修改线上内容）");
    return;
  }

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
      // 时间轴全段是「从项目启动到今天」的**升序**（线上现状：09-09 → 09-16），
      // 所以新的一天必须追加到**末尾**。
      //
      // ⚠️ 别改回「插在 `## 迭代时间轴` 正下方」（2026-09-17 踩过）：那样最新一天会
      // 孤零零飘在整段最上面，读者滚到时间轴末尾——也就是最新记录本该在的位置——
      // 反而找不到当天的更新，会以为时间轴没更新。
      //
      // 末尾的判定：整段正文里最后一个 `---` 之前（`---` 后面那句
      // 「如果你也想搭一个类似的博客…」要求永远钉在整页最底），没有就落到文末。
      let insertAt = content.length;
      const lastSep = content.lastIndexOf("\n---");
      if (lastSep > idx) insertAt = lastSep;
      content =
        content.slice(0, insertAt).replace(/\s+$/, "") +
        "\n\n" +
        newSection +
        "\n" +
        content.slice(insertAt);
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
