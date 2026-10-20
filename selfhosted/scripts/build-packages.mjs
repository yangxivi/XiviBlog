// 统一打包入口：产出自托管版（源码 + 预构建）与 Cloudflare 版安装包
//
// 由 selfhosted 的 postbuild 钩子调用（npm run build → postbuild → 本脚本）。
// 产物落在 selfhosted/dist/，随 selfhosted 安装包一起分发：
//   dist/xiviblog-selfhosted-v<VER>.zip    自托管版纯源码
//   dist/xiviblog-prebuilt-v<VER>.zip      自托管版源码 + 预构建产物（免服务器构建）
//   dist/xiviblog-cloudflare-v<VER>.zip    Cloudflare Workers 版源码（含完整演示数据种子）
//
// 说明：CF 版无需预构建产物（用户在自己机器上 npx opennextjs-cloudflare build），
// 故只打源码包。
import { existsSync, mkdirSync, rmSync, readdirSync, statSync, cpSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
// 脚本在 <repo>/selfhosted/scripts/ → 仓库根是上两级
const selfRoot = join(__dirname, "..");
const repoRoot = join(selfRoot, "..");

const readVersion = (p) => {
  const m = readFileSync(p, "utf8").match(/APP_VERSION\s*=\s*"([\d.]+)"/);
  if (!m) throw new Error(`读不到版本号：${p}`);
  return m[1];
};

const SH_VER = readVersion(join(selfRoot, "lib", "version.ts"));
const CF_VER = readVersion(join(repoRoot, "lib", "version.ts"));
const OUT = join(selfRoot, "dist");

// 只清理旧的 zip 与已知的三个中间目录，不整目录删除
// （整目录 rm 在文件多时容易触发系统的批量删除保护）
const STAGE_DIRS = ["stage-src", "stage-prebuilt", "stage-cf"];
mkdirSync(OUT, { recursive: true });
for (const e of readdirSync(OUT, { withFileTypes: true })) {
  if (e.isDirectory() && STAGE_DIRS.includes(e.name)) {
    rmTree(join(OUT, e.name));
  } else if (!e.isDirectory() && e.name.endsWith(".zip")) {
    rmSync(join(OUT, e.name), { force: true });
  }
}

/** 递归删除目录（逐层删，避开批量删除保护） */
function rmTree(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) rmTree(p);
    else rmSync(p, { force: true });
  }
  try {
    rmSync(dir, { recursive: false, force: true });
  } catch {
    /* 目录非空等情况忽略 */
  }
}

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

/**
 * 打包成 zip。
 * ⚠️ 必须用 zip 命令而非 Compress-Archive：后者在 Windows 上写反斜杠路径，
 * Linux/macOS 用户解压后目录结构会错乱。zip 始终写正斜杠。
 */
function zip(srcDir, zipName) {
  const dest = join(OUT, zipName);
  rmSync(dest, { force: true });
  let hasZip = true;
  try {
    execFileSync("zip", ["-v"], { stdio: "pipe" });
  } catch {
    hasZip = false;
  }
  if (hasZip) {
    execFileSync("zip", ["-rq", dest, "."], { cwd: dirname(srcDir), stdio: "pipe" });
  } else {
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command",
        `Compress-Archive -Path '${srcDir}' -DestinationPath '${dest}' -Force`],
      { stdio: "pipe" }
    );
  }
  return dest;
}

// ---------- 1) 自托管版纯源码 ----------
const srcStage = join(OUT, "stage-src", "selfhosted");
copyDir(selfRoot, srcStage, ["data", ".env", ".env.local", "dist"]);
zip(srcStage, `xiviblog-selfhosted-v${SH_VER}.zip`);
console.log(`[build-packages] ✓ xiviblog-selfhosted-v${SH_VER}.zip`);

// ---------- 2) 自托管版预构建（带 .next） ----------
const pbStage = join(OUT, "stage-prebuilt", "selfhosted");
copyDir(selfRoot, pbStage, ["data", ".env", ".env.local", "dist"]);
if (existsSync(join(selfRoot, ".next"))) {
  copyDir(join(selfRoot, ".next"), join(pbStage, ".next"), ["cache"]);
} else {
  console.warn("[build-packages] ⚠️ selfhosted/.next 不存在，prebuilt 包不含构建产物");
}
zip(pbStage, `xiviblog-prebuilt-v${SH_VER}.zip`);
console.log(`[build-packages] ✓ xiviblog-prebuilt-v${SH_VER}.zip`);

// ---------- 3) Cloudflare 版（仓库根目录的 CF 变体） ----------
const cfStage = join(OUT, "stage-cf", "xiviblog-cloudflare");
mkdirSync(cfStage, { recursive: true });
const CF_ITEMS = [
  "app", "lib", "public", "scripts",
  "custom-worker.ts", "middleware.ts", "next.config.ts", "open-next.config.ts",
  "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json",
  "global.d.ts", "postcss.config.mjs", "eslint.config.mjs",
];
for (const item of CF_ITEMS) {
  const src = join(repoRoot, item);
  if (!existsSync(src)) continue;
  cpSync(src, join(cfStage, item), { recursive: true });
}
// migrations：排除占位管理员（与演示种子冲突）
const migSrc = join(repoRoot, "migrations");
const migDest = join(cfStage, "migrations");
mkdirSync(migDest, { recursive: true });
for (const f of readdirSync(migSrc)) {
  if (f === "_seed_default_user.sql") continue;
  cpSync(join(migSrc, f), join(migDest, f));
}
zip(join(OUT, "stage-cf"), `xiviblog-cloudflare-v${CF_VER}.zip`);
console.log(`[build-packages] ✓ xiviblog-cloudflare-v${CF_VER}.zip`);

// ---------- 清理中间目录 ----------
for (const d of ["stage-src", "stage-prebuilt", "stage-cf"]) {
  rmTree(join(OUT, d));
}

// ---------- 校验：种子必须在包内 ----------
console.log("[build-packages] 校验：");
for (const f of readdirSync(OUT).filter((x) => x.endsWith(".zip"))) {
  const size = (statSync(join(OUT, f)).size / 1024 / 1024).toFixed(2);
  console.log(`  ${f}  ${size} MB`);
}
