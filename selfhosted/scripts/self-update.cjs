/* eslint-disable */
/**
 * XiviBlog 自托管版 · 在线更新执行脚本（由 /api/admin/update 派生，detached 运行）
 *
 * 三条安装通道（按优先级）：
 *   1. 预构建通道：Release 里的 *prebuilt*.zip（源码 + CI 产出的 .next），
 *      覆盖进应用目录后【跳过构建】直接重启 —— 小内存服务器首选。
 *   2. zip 源码通道：Release 里的 *selfhosted*.zip（完整源码），需要本地构建。
 *   3. tarball 通道：GitHub 源码 tarball，需要本地构建。
 *
 * 兼容性：旧版 /api/admin/update（编译产物在跑）只往 job 里写 tarballUrl，
 * 本脚本检测到 job 缺 zipUrl/prebuiltUrl 时会自己查 GitHub API 补齐。
 *
 * 所有外部命令的输出全部落盘 data/update-build.log；失败时把尾部输出
 * 回写进 job.log（后台面板可见），不再出现「构建失败」却无原因的黑箱。
 *
 * 注意：本脚本是「纯 Node + 系统命令」，不依赖任何项目内部模块，
 * 因为更新过程中应用目录会被覆盖，import 内部模块会在半途失效。
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const REPO = "yangxivi/XiviBlog";
const APP_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(APP_DIR, "data");
const JOB_FILE = path.join(DATA_DIR, "update-job.json");
const BUILD_LOG = path.join(DATA_DIR, "update-build.log");

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
/** 北京时间 HH:MM:SS（toISOString 是 UTC，会与用户时钟差 8 小时） */
function nowTs() {
  return new Date().toLocaleTimeString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false });
}
function log(line) {
  const job = readJob();
  job.log = (job.log || []).concat(`[${nowTs()}] ${line}`).slice(-200);
  writeJob(job);
  console.log(line);
}

/** 命令输出统一落盘，失败原因不再被吞 */
function buildLogWrite(section, text) {
  try {
    fs.appendFileSync(
      BUILD_LOG,
      `\n===== [${nowTs()}] ${section} =====\n${text || "(无输出)"}\n`,
      "utf8"
    );
  } catch {}
}

/** 优先 curl，其次 wget，最后 Node https 下载 */
function download(url, dest) {
  try {
    execFileSync("curl", ["-fL", "--retry", "3", "--connect-timeout", "15", "-o", dest, url], { stdio: "ignore" });
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
    const req = https.get(url, { headers: { "User-Agent": "XiviBlog-Updater" }, timeout: 20000 }, (res) => {
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
    req.on("timeout", () => {
      req.destroy();
      f.close();
      resolve(false);
    });
  });
}

/** 查询某 tag 的 Release 资产（旧版主程序不传 zipUrl/prebuiltUrl 时兜底） */
function fetchAssetsForTag(tag) {
  try {
    const https = require("node:https");
    const body = JSON.parse(
      execFileSync("curl", [
        "-fsL", "--connect-timeout", "15",
        "-H", "User-Agent: XiviBlog-Updater",
        "-H", "Accept: application/vnd.github+json",
        `https://api.github.com/repos/${REPO}/releases/tags/${tag}`,
      ], { stdio: "pipe", timeout: 30000 }).toString("utf8")
    );
    const assets = body.assets || [];
    const pick = (pred) => {
      const a = assets.find(pred);
      return a ? a.browser_download_url : null;
    };
    return {
      zipUrl: pick((a) => (a.name || "").toLowerCase().includes("selfhosted") && (a.name || "").endsWith(".zip")),
      prebuiltUrl: pick((a) => (a.name || "").toLowerCase().includes("prebuilt") && (a.name || "").endsWith(".zip")),
    };
  } catch (e) {
    buildLogWrite("查询 Release 资产", String(e && e.message ? e.message : e));
    return { zipUrl: null, prebuiltUrl: null };
  }
}

function extract(tarball, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", outDir], { stdio: "ignore" });
}

/** 解压 zip：python3 → unzip → Node 兜底 */
function extractZip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  let admZip = null;
  try { admZip = require("adm-zip"); } catch {}
  const attempts = [];
  if (fs.existsSync("/usr/bin/python3") || fs.existsSync("/usr/local/bin/python3")) {
    attempts.push(() => {
      execFileSync("python3", ["-c", `
import zipfile, sys
with zipfile.ZipFile(sys.argv[1], 'r') as z:
    z.extractall(sys.argv[2])
print(f"Extracted {len(z.namelist())} files")
`, zipPath, outDir], { stdio: "pipe" });
      return true;
    });
  }
  attempts.push(() => {
    execFileSync("unzip", ["-oq", zipPath, "-d", outDir], { stdio: "pipe" });
    return true;
  });
  if (admZip) {
    attempts.push(() => {
      new admZip(zipPath).extractAllTo(outDir, true);
      return true;
    });
  }
  let lastErr;
  for (const fn of attempts) {
    try { return fn(); } catch (e) { lastErr = e; }
  }
  throw new Error("无法解压 zip：" + (lastErr && lastErr.message ? lastErr.message : "无可用解压工具"));
}

/** 在解包目录里找到含 package.json 的 selfhosted 根 */
function findSelfhostedRoot(dir) {
  if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "app"))) {
    return dir;
  }
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
  // 合并式复制：同名覆盖，其余保留（不删除 dest 中多余文件，保护用户数据）
  execFileSync("cp", ["-r", src.replace(/\/$/, "") + "/.", dest + "/"], { stdio: "ignore" });
}

/** 环境自检：node/npm 版本 + 可用内存（构建失败排查第一现场） */
function logEnv(label) {
  let info = "";
  try {
    info += `node ${spawnSync("node", ["-v"], { encoding: "utf8" }).stdout.trim()} `;
  } catch {}
  try {
    info += `npm ${spawnSync("npm", ["-v"], { encoding: "utf8" }).stdout.trim()} `;
  } catch {}
  try {
    const mi = fs.readFileSync("/proc/meminfo", "utf8");
    const m = mi.match(/MemAvailable:\s+(\d+) kB/);
    if (m) info += `MemAvailable=${Math.round(Number(m[1]) / 1024)}MB`;
  } catch {}
  log(`[${label}] ${info}`);
}

/**
 * 执行外部命令：输出落盘 data/update-build.log；失败时把尾部写进 job.log。
 * 返回 { ok, output }；status 为 null 且有 signal 时提示被信号杀死（常见 = OOM）。
 */
function run(cmd, args, env) {
  const label = `${cmd} ${args.join(" ")}`;
  const r = spawnSync(cmd, args, {
    cwd: APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...(env || {}) },
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  buildLogWrite(label, out);
  if (r.status === 0) return { ok: true, output: out };
  let head = `✗ ${label} 失败`;
  if (r.status === null && r.signal) head += `（进程被信号 ${r.signal} 终止，通常是内存不足被系统 OOM 杀掉）`;
  else if (r.error) head += `（${r.error.message}，常见原因是 PATH 里找不到该命令）`;
  else head += `（退出码 ${r.status}）`;
  const tail = out.split("\n").slice(-30).join("\n");
  log(head + (tail ? `\n---- 命令输出尾部 ----\n${tail}\n---- 完整输出见 data/update-build.log ----` : "（无输出，完整日志见 data/update-build.log）"));
  return { ok: false, output: out };
}

function writeDeployedVersion(v) {
  try {
    fs.writeFileSync(
      path.join(DATA_DIR, "version.json"),
      JSON.stringify({ version: v.replace(/^v/, ""), deployedAt: new Date().toISOString() }),
      "utf8"
    );
  } catch {}
}

/** 依赖是否变化（变了才 npm install，保住服务器现成的 node_modules）。
 * oldPkgJson 必须在 copyTree 覆盖前抓快照，否则新旧永远相等。 */
function depsChanged(newRoot, oldPkgJson) {
  const newPkg = path.join(newRoot, "package.json");
  try {
    if (oldPkgJson && fs.existsSync(newPkg)) {
      const a = JSON.stringify(JSON.parse(oldPkgJson));
      const b = JSON.stringify(require(newPkg));
      return a !== b;
    }
  } catch {}
  return true;
}

function restartAndCheck(job) {
  job.status = "restarting";
  writeJob(job);
  log("重启服务（pm2 restart xiviblog）…");
  run("pm2", ["restart", "xiviblog"], { NODE_OPTIONS: "" });

  // 稍等让 pm2 拉起，做个存活校验（注意：服务是 http 不是 https）
  return new Promise((resolve) => {
    setTimeout(async () => {
      let alive = false;
      try {
        const http = require("node:http");
        alive = await new Promise((res) => {
          const req = http.get({ host: "127.0.0.1", port: 3000, path: "/api/install", timeout: 5000 }, (r) => {
            r.resume();
            res(r.statusCode === 200 || r.statusCode === 409);
          });
          req.on("error", () => res(false));
          req.on("timeout", () => { req.destroy(); res(false); });
        });
      } catch {}
      log(alive ? "✓ 服务已重启且健康检查通过，更新完成！" : "⚠ 重启后健康检查未通过，请手动检查 pm2 日志");
      job.status = "done";
      job.finishedAt = new Date().toISOString();
      writeJob(job);
      resolve();
    }, 4000);
  });
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
    logEnv("回滚构建前");
    if (!run("npm", ["run", "build"], { NODE_OPTIONS: "" }).ok) {
      log("✗ 回滚后构建失败。请把 data/update-build.log 最后一段发出来排查；服务可能需要 pm2 手动重启。");
    }
    run("pm2", ["restart", "xiviblog"], { NODE_OPTIONS: "" });
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

/** 下载 + 解包 + 找到 selfhosted 根；失败返回 null（原因已写入日志） */
async function fetchAndExtract(job, url, kind) {
  const tmpBase = path.join(DATA_DIR, ".update");
  fs.mkdirSync(tmpBase, { recursive: true });
  const packagePath = path.join(tmpBase, kind === "prebuilt" ? "prebuilt.zip" : kind === "zip" ? "release.zip" : "release.tar.gz");

  log(`下载 ${kind} 包: ${url.split("/").pop()}`);
  const ok = await download(url, packagePath);
  if (!ok) {
    buildLogWrite(`下载 ${kind}`, `下载失败: ${url}`);
    return null;
  }
  log(`下载完成（${Math.round(fs.statSync(packagePath).size / 1024)} KB），开始解包…`);

  const extractDir = path.join(tmpBase, "src-" + Date.now());
  try {
    if (kind === "tarball") extract(packagePath, extractDir);
    else extractZip(packagePath, extractDir);
  } catch (e) {
    log("解包失败：" + (e && e.message ? e.message : e));
    return null;
  }
  const root = findSelfhostedRoot(extractDir);
  if (!root) {
    log("✗ 未在更新包中找到 selfhosted 根目录（缺 package.json 或 app/）");
    return null;
  }
  log("找到源码根，合并到应用目录（保留用户数据/配置）…");
  // 覆盖前快照旧 package.json（供依赖变化比对）
  let oldPkgJson = null;
  try { oldPkgJson = fs.readFileSync(path.join(APP_DIR, "package.json"), "utf8"); } catch {}
  copyTree(root, APP_DIR);
  return { root, oldPkgJson };
}

async function main() {
  const job = readJob();
  job.status = "downloading";
  writeJob(job);

  // 旧版主程序只传 tarballUrl —— 自己查 Release 补齐 zip/prebuilt 地址
  let { zipUrl, prebuiltUrl } = job;
  if (!prebuiltUrl || !zipUrl) {
    log("查询 GitHub Release 资产清单…");
    const extra = fetchAssetsForTag(job.target);
    prebuiltUrl = prebuiltUrl || extra.prebuiltUrl;
    zipUrl = zipUrl || extra.zipUrl;
    if (prebuiltUrl) job.prebuiltUrl = prebuiltUrl;
    if (zipUrl) job.zipUrl = zipUrl;
    writeJob(job);
  }

  // ===== 通道 1：预构建（免服务器构建，小内存机器首选）=====
  if (prebuiltUrl) {
    log("检测到预构建产物，走免构建安装通道…");
    const got = await fetchAndExtract(job, prebuiltUrl, "prebuilt");
    if (got) {
      job.status = "installing";
      writeJob(job);
      if (depsChanged(got.root, got.oldPkgJson)) {
        log("依赖有变化，执行 npm install…");
        logEnv("npm install 前");
        if (!run("npm", ["install"], { NODE_OPTIONS: "" }).ok) {
          log("✗ npm install 失败，尝试回滚");
          attemptRollback(job);
          return;
        }
      } else {
        log("依赖无变化，沿用服务器现成 node_modules，跳过 install 与 build");
      }
      writeDeployedVersion(job.target);
      log("预构建安装完成，写入版本号 " + job.target);
      await restartAndCheck(job);
      cleanup();
      return;
    }
    log("预构建通道失败，回退到源码构建通道…");
  }

  // ===== 通道 2/3：zip 源码 / tarball（需要本地构建）=====
  let root = null;
  let oldPkgJson = null;
  if (zipUrl) {
    const got = await fetchAndExtract(job, zipUrl, "zip");
    if (got) { root = got.root; oldPkgJson = got.oldPkgJson; }
  }
  if (!root && job.tarballUrl) {
    const got = await fetchAndExtract(job, job.tarballUrl, "tarball");
    if (got) { root = got.root; oldPkgJson = got.oldPkgJson; }
  }
  if (!root) {
    job.status = "failed";
    job.error = "下载或解包更新包失败（详见 data/update-build.log）";
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    attemptRollback(job);
    return;
  }

  job.status = "installing";
  writeJob(job);
  if (depsChanged(root, oldPkgJson)) {
    log("依赖有变化，执行 npm install…");
    logEnv("npm install 前");
    if (!run("npm", ["install"], { NODE_OPTIONS: "" }).ok) {
      log("✗ npm install 失败，尝试回滚");
      attemptRollback(job);
      return;
    }
  } else {
    log("依赖无变化，跳过 npm install");
  }

  logEnv("构建前");
  job.status = "building";
  writeJob(job);
  log("开始构建（npm run build）…");
  if (!run("npm", ["run", "build"], { NODE_OPTIONS: "" }).ok) {
    log("✗ 构建失败，尝试回滚（完整报错见 data/update-build.log）");
    attemptRollback(job);
    return;
  }

  writeDeployedVersion(job.target);
  log("构建成功，写入版本号 " + job.target);
  await restartAndCheck(job);
  cleanup();
}

function cleanup() {
  try {
    fs.rmSync(path.join(DATA_DIR, ".update"), { recursive: true, force: true });
  } catch {}
}

main().catch((e) => {
  const job = readJob();
  log("更新脚本异常：" + (e && e.message ? e.message : e));
  attemptRollback(job);
});
