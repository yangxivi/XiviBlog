/* eslint-disable */
/**
 * XiviBlog 自托管版 · 在线更新执行脚本（由 /api/admin/update 派生，detached 运行）
 *
 * 流程：下载 GitHub 源码 tarball → 解包 → 覆盖式合并进应用目录
 *      →（如依赖变化）npm install → npm run build → 写 version.json → pm2 restart
 * 任一步失败：自动用更新前的源码备份（job.rollbackFile）回滚并重启。
 *
 * 注意：本脚本是「纯 Node + 系统命令」，不依赖任何项目内部模块，
 * 因为更新过程中应用目录会被覆盖，import 内部模块会在半途失效。
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
    return { status: "queued", log: [] };
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

/** 优先 curl，其次 wget，最后 Node https 下载 */
function download(url, dest) {
  try {
    execFileSync("curl", ["-fL", "--retry", "3", "-o", dest, url], { stdio: "ignore" });
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  } catch {}
  try {
    execFileSync("wget", ["-q", "-O", dest, url], { stdio: "ignore" });
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  } catch {}
  // Node 兜底
  return new Promise((resolve) => {
    const https = require("node:https");
    const f = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { "User-Agent": "XiviBlog-Updater" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        f.close();
        fs.unlinkSync(dest);
        return resolve(download(res.headers.location, dest));
      }
      res.pipe(f);
      f.on("finish", () => {
        f.close();
        resolve(fs.existsSync(dest) && fs.statSync(dest).size > 0);
      });
    });
    req.on("error", () => {
      f.close();
      resolve(false);
    });
  });
}

function extract(tarball, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", outDir], { stdio: "ignore" });
}

/** 在解包目录里找到含 package.json 的 selfhosted 根 */
function findSelfhostedRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, "package.json")) && fs.existsSync(path.join(p, "app"))) {
      return p;
    }
    const deep = findSelfhostedRoot(p);
    if (deep) return deep;
  }
  return null;
}

function copyTree(src, dest) {
  // 合并式复制：同名覆盖，其余保留（不删除 dest 中多余文件，保护用户上传）
  execFileSync("cp", ["-r", src.replace(/\/$/, "") + "/.", dest + "/"], { stdio: "ignore" });
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    cwd: APP_DIR,
    stdio: "ignore",
    env: { ...process.env, ...(env || {}) },
  });
  return r.status === 0;
}

function writeDeployedVersion(v) {
  try {
    fs.writeFileSync(
      path.join(DATA_DIR, "version.json"),
      JSON.stringify({ version: v, deployedAt: new Date().toISOString() }),
      "utf8"
    );
  } catch {}
}

function attemptRollback(job) {
  log("⚠️ 更新失败，尝试自动回滚到更新前源码备份…");
  const rb = job.rollbackFile;
  if (!rb || !fs.existsSync(rb)) {
    log("✗ 未找到回滚备份，无法自动恢复，请手动处理。");
    job.status = "failed";
    job.error = "更新失败且无可用的回滚备份";
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    return;
  }
  try {
    const tmp = path.join(DATA_DIR, ".rollback", "restore-" + Date.now());
    extract(rb, tmp);
    const root = findSelfhostedRoot(tmp) || tmp;
    copyTree(root, APP_DIR);
    log("已恢复更新前源码，开始重建…");
    if (!run("npm", ["run", "build"], { NODE_OPTIONS: "" })) {
      log("✗ 回滚后构建失败，请手动检查。");
    }
    run("pm2", ["restart", "xiviblog"]);
    log("✓ 已自动回滚并重启。");
    job.status = "rolled_back";
    job.finishedAt = new Date().toISOString();
    job.log.push("自动回滚完成");
    writeJob(job);
  } catch (e) {
    log("✗ 自动回滚异常：" + (e && e.message ? e.message : e));
    job.status = "failed";
    job.error = "更新失败且回滚异常：" + (e && e.message ? e.message : e);
    job.finishedAt = new Date().toISOString();
    writeJob(job);
  }
}

async function main() {
  const job = readJob();
  job.status = "downloading";
  writeJob(job);

  const tmpBase = path.join(DATA_DIR, ".update");
  fs.mkdirSync(tmpBase, { recursive: true });
  const tarball = path.join(tmpBase, "release.tar.gz");

  log("正在下载新版本源码…");
  const ok = await download(job.tarballUrl, tarball);
  if (!ok) {
    job.status = "failed";
    job.error = "下载更新包失败";
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    return;
  }
  log("下载完成，开始解包…");

  const extractDir = path.join(tmpBase, "src-" + Date.now());
  try {
    extract(tarball, extractDir);
  } catch (e) {
    log("解包失败：" + (e && e.message ? e.message : e));
    job.status = "failed";
    job.error = "解包失败";
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    return;
  }

  const root = findSelfhostedRoot(extractDir);
  if (!root) {
    log("✗ 未在更新包中找到 selfhosted 根目录");
    job.status = "failed";
    job.error = "更新包结构异常";
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    return;
  }
  log("找到源码根，合并到应用目录（保留用户数据/配置）…");
  try {
    copyTree(root, APP_DIR);
  } catch (e) {
    log("合并文件失败：" + (e && e.message ? e.message : e));
    attemptRollback(job);
    return;
  }

  // 依赖是否变化？
  job.status = "installing";
  writeJob(job);
  const oldPkg = path.join(APP_DIR, "package.json");
  const newPkg = path.join(root, "package.json");
  let needInstall = true;
  try {
    if (fs.existsSync(oldPkg) && fs.existsSync(newPkg)) {
      const a = JSON.stringify(require(oldPkg));
      const b = JSON.stringify(require(newPkg));
      needInstall = a !== b;
    }
  } catch {}
  if (needInstall) {
    log("依赖有变化，执行 npm install…");
    if (!run("npm", ["install"], { NODE_OPTIONS: "" })) {
      log("✗ npm install 失败，尝试回滚");
      attemptRollback(job);
      return;
    }
  } else {
    log("依赖无变化，跳过 npm install");
  }

  // 构建
  job.status = "building";
  writeJob(job);
  log("开始构建（npm run build）…");
  if (!run("npm", ["run", "build"], { NODE_OPTIONS: "" })) {
    log("✗ 构建失败，尝试回滚");
    attemptRollback(job);
    return;
  }

  // 记录已部署版本
  writeDeployedVersion(job.target);
  log("构建成功，写入版本号 " + job.target);

  // 重启
  job.status = "restarting";
  writeJob(job);
  log("重启服务（pm2 restart xiviblog）…");
  run("pm2", ["restart", "xiviblog"]);

  // 稍等让 pm2 拉起，做个存活校验
  await new Promise((r) => setTimeout(r, 4000));
  try {
    const https = require("node:http");
    const alive = await new Promise((res) => {
      const req = https.get({ host: "127.0.0.1", port: 3000, path: "/api/install", timeout: 5000 }, (r) => {
        r.resume();
        res(r.statusCode === 200);
      });
      req.on("error", () => res(false));
      req.on("timeout", () => { req.destroy(); res(false); });
    });
    log(alive ? "✓ 服务已重启且健康检查通过，更新完成！" : "⚠ 重启后健康检查未通过，请手动检查日志");
  } catch {
    log("⚠ 无法执行健康检查，但已触发重启");
  }

  job.status = "done";
  job.finishedAt = new Date().toISOString();
  writeJob(job);

  // 清理临时文件
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch {}
}

main().catch((e) => {
  const job = readJob();
  log("更新脚本异常：" + (e && e.message ? e.message : e));
  attemptRollback(job);
});
