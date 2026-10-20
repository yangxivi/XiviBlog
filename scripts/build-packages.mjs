#!/usr/bin/env node
/**
 * 本地打包 XiviBlog 安装包（三种）
 *
 * 用法：node scripts/build-packages.mjs [版本号]
 *
 * 产出（dist-packages/ 下）：
 *   xiviblog-selfhosted-v<VER>.zip   自托管版纯源码（服务器上需 npm run build）
 *   xiviblog-prebuilt-v<VER>.zip     自托管版源码 + 构建产物（免服务器构建）
 *   xiviblog-cloudflare-v<VER>.zip   Cloudflare Workers 版源码（含完整演示数据种子）
 *
 * 三个包都内置 migrations/_seed_full.json：站点设置 + 183 篇文章 + 页面 + 留言，
 * 用户装完可在后台自由修改或删除。
 */
import {
  readFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync, statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const readVersion = (p) => {
  const m = readFileSync(p, "utf8").match(/APP_VERSION\s*=\s*"([\d.]+)"/);
  if (!m) throw new Error(`读不到版本号：${p}`);
  return m[1];
};

const VER = process.argv[2] || readVersion(join(root, "lib", "version.ts"));
const SH_VER = readVersion(join(root, "selfhosted", "lib", "version.ts"));
console.log(`版本：CF ${VER} / selfhosted ${SH_VER}`);

const OUT = join(root, "dist-packages");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** 递归复制目录，可排除顶层目录名 */
function copyDir(src, dest, excludes = []) {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next"].includes(e.name)) continue;
    if (excludes.includes(e.name)) continue;
    const from = join(src, e.name);
    const to = join(dest, e.name);
    if (e.isDirectory()) copyDir(from, to, excludes);
    else cpSync(from, to);
  }
}

function zip(srcDir, zipName) {
  const dest = join(OUT, zipName);
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command",
      `Compress-Archive -Path '${srcDir}' -DestinationPath '${dest}' -Force`],
    { stdio: "pipe" }
  );
  return dest;
}

// ---------- 1) selfhosted 纯源码包 ----------
const shStage = join(OUT, "src", "selfhosted");
copyDir(join(root, "selfhosted"), shStage, ["data", ".env", ".env.local"]);
zip(shStage, `xiviblog-selfhosted-v${SH_VER}.zip`);
console.log(`✓ xiviblog-selfhosted-v${SH_VER}.zip`);

// ---------- 2) selfhosted prebuilt 包（带 .next 构建产物） ----------
const pbStage = join(OUT, "prebuilt", "selfhosted");
copyDir(join(root, "selfhosted"), pbStage, ["data", ".env", ".env.local"]);
if (existsSync(join(root, "selfhosted", ".next"))) {
  copyDir(join(root, "selfhosted", ".next"), join(pbStage, ".next"), ["cache"]);
} else {
  console.warn("⚠️ selfhosted/.next 不存在，prebuilt 包不含构建产物");
}
zip(pbStage, `xiviblog-prebuilt-v${SH_VER}.zip`);
console.log(`✓ xiviblog-prebuilt-v${SH_VER}.zip`);

// ---------- 3) cloudflare 包 ----------
const cfStage = join(OUT, "cf", "xiviblog-cloudflare");
mkdirSync(cfStage, { recursive: true });
const CF_ITEMS = [
  "app", "lib", "public", "scripts",
  "custom-worker.ts", "middleware.ts", "next.config.ts", "open-next.config.ts",
  "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json",
  "global.d.ts", "postcss.config.mjs", "eslint.config.mjs",
];
for (const item of CF_ITEMS) {
  const src = join(root, item);
  if (!existsSync(src)) { console.warn(`  跳过（不存在）：${item}`); continue; }
  cpSync(src, join(cfStage, item), { recursive: true });
}
// migrations 单独处理：排除占位管理员（与演示种子冲突）
const migSrc = join(root, "migrations");
const migDest = join(cfStage, "migrations");
mkdirSync(migDest, { recursive: true });
for (const f of readdirSync(migSrc)) {
  if (f === "_seed_default_user.sql") continue;
  cpSync(join(migSrc, f), join(migDest, f));
}
zip(join(OUT, "cf", "xiviblog-cloudflare"), `xiviblog-cloudflare-v${VER}.zip`);
console.log(`✓ xiviblog-cloudflare-v${VER}.zip`);

// ---------- 校验：种子必须在包内 ----------
console.log("\n=== 校验种子文件 ===");
for (const f of readdirSync(OUT).filter((x) => x.endsWith(".zip"))) {
  const p = join(OUT, f);
  const has = f.includes("cloudflare")
    ? existsSync(join(cfStage, "migrations", "_seed_full.json"))
    : existsSync(join(f.includes("prebuilt") ? pbStage : shStage, "migrations", "_seed_full.json"));
  console.log(`  ${has ? "✓" : "✗"} ${f}  ${(statSync(p).size / 1024 / 1024).toFixed(2)} MB  种子:${has ? "有" : "缺"}`);
}
console.log(`\n输出目录：${OUT}`);
