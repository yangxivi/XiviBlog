// 把本次迭代追加到「关于本站」页面的时间轴里。
// 用法：node scripts/update-timeline.mjs
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b433825d809e0bb7e7ba0bb3946ced9f";
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || "0a6dacad-4281-4016-aa90-ce912fe9fa6a";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const date = "2026-09-14";
const heading = "交互、主题与模块完善";
const bullets = [
  "页脚标题颜色与字号统一为站名样式，并跟随主题色变化",
  "自定义页面去掉 `/p/` 前缀，直接以 `blog.aixivi.cn/<slug>` 访问；「关于本站」并入页面管理",
  "修复页面打开/刷新后滚动位置被保留的问题，每次进入自动回到顶部",
  "轮播右侧 1~5 名排名徽章改为与侧边栏「推荐阅读」一致的数字样式",
  "后台「站点设置」移除页脚实时预览折叠区，减少重复干扰",
  "后台橱窗卡片样式文案通用化：「白底描边 / 品牌色渐变 / 深色」，随主题切换",
  "侧边栏新增「最新评论」模块，可展示最近 5 条评论及来源文章",
  "侧边栏滚动条隐藏但保留滚动能力，界面更清爽",
  "侧栏「推荐阅读」名额上限由 5 篇提升到 10 篇",
  "修复推荐名额提示仍为 5 篇的问题：补改 `lib/db.ts` 根常量 `RECOMMEND_LIMIT = 10` 后重新部署",
  "修复「推荐阅读」前 3 名与 4-10 名数字大小不一：取消渐变文字裁剪，统一为相同字号、字重与 24px 宽度的实色数字",
  "侧边栏「最新评论」评论正文由两行改为单行截断，完整内容悬停显示",
  "页脚导航列改为同排多列布局：桌面端 4 列一行显示，不再折成两排",
  "页脚上部整体改为五等分：品牌区 + 导航 / 资源 / 其它 / 订阅四栏横向均分总宽度",
  "移动端页脚布局优化：品牌区独占一行，导航/资源、其它/订阅分别 2×2 两列排布，桌面端保持五等分",
  "页脚链接分组最多限制 4 组：后台「添加分组」按钮达到 4 组后禁用，`lib/settings.ts` 的 `normColumns` 同步截断到 4 组",
  "页脚四列分组整体向右偏移：桌面端品牌区与分组之间间距由 gap-x-6 加大到 gap-x-10，避免离「曦微博客」太近",
  "页脚分组标题字号由 15px 缩小到 13px，视觉更紧凑",
  "轮播图底部摘要由两行改为一行截断，完整内容悬停显示",
  "全站加载速度优化：加入边缘缓存后，重复访问的页面首字节时间从 1~2.6 秒降到 0.25~0.5 秒",
  "站内点击切换页面的响应速度同步优化，从 3 秒级降到 0.5 秒级",
  "登录后台后浏览前台不再使用公共缓存，保证「编辑」等站长入口显示正确",
  "历史文章页改为按需分页加载，首屏体积由 1.2MB 降到 351KB（约 −72%）",
  "文章列表缩略图改用 WebP 重新生成，161 张总量从 869KB 降到 542KB，画质不变",
  "首页首屏体积由 486KB 降到 361KB；翻页数据接口由 164KB 降到 104KB",
];

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
