/* eslint-disable */
/**
 * XiviBlog 自托管版 · 回滚执行脚本（由 /api/admin/update/rollback 派生，detached 运行）
 * 把更新前备份的源码 tar.gz 解回应用目录 → 重建 → 重启。数据快照由调用方在重启前已恢复。
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const APP_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(APP_DIR, "data");
const JOB_FILE = path.join(DATA_DIR, "update-job.json");

function readJob() {
  try {
    return JSON.parse(fs.readFileSync(JOB_FILE, "utf8"));
  } catch {
    return { status: "rolled_back", log: [] };
  }
}
function writeJob(job) {
  try {
    fs.writeFileSync(JOB_FILE, JSON.stringify(job, null, 2), "utf8");
  } catch {}
}
function log(line) {
  const job = readJob();
  job.log = (job.log || []).concat(`[${new Date().toISOString().slice(11, 19)}] ${line}`).slice(-200);
  writeJob(job);
  console.log(line);
}

function extract(tarball, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", outDir], { stdio: "ignore" });
}
function findSelfhostedRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, "package.json")) && fs.existsSync(path.join(p, "app"))) return p;
    const deep = findSelfhostedRoot(p);
    if (deep) return deep;
  }
  return null;
}
function copyTree(src, dest) {
  execFileSync("cp", ["-r", src.replace(/\/$/, "") + "/.", dest + "/"], { stdio: "ignore" });
}
function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { cwd: APP_DIR, stdio: "ignore", env: { ...process.env, ...(env || {}) } });
  return r.status === 0;
}

function main() {
  const file = process.env.ROLLBACK_FILE;
  if (!file || !fs.existsSync(file)) {
    log("✗ 回滚失败：备份文件不存在 " + file);
    return;
  }
  const job = readJob();
  log("开始回滚：解包源码备份 " + file);
  const tmp = path.join(DATA_DIR, ".rollback", "restore-" + Date.now());
  try {
    extract(file, tmp);
  } catch (e) {
    log("✗ 解包备份失败：" + (e && e.message ? e.message : e));
    return;
  }
  const root = findSelfhostedRoot(tmp) || tmp;
  try {
    copyTree(root, APP_DIR);
    log("已恢复源码，开始重建…");
  } catch (e) {
    log("✗ 恢复文件失败：" + (e && e.message ? e.message : e));
    return;
  }
  if (!run("npm", ["run", "build"], { NODE_OPTIONS: "" })) {
    log("✗ 回滚后构建失败，请手动检查。");
    return;
  }
  run("pm2", ["restart", "xiviblog"]);
  log("✓ 回滚完成并已重启服务。");
  job.status = "rolled_back";
  job.finishedAt = new Date().toISOString();
  writeJob(job);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

main();
