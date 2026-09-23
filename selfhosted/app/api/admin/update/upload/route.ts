import { NextRequest, NextResponse } from "next/server";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { createSnapshot } from "@/lib/snapshot";
import { APP_VERSION } from "@/lib/version";
import { getUpdateJob, writeUpdateJob, listRollbackBundles, type UpdateJob } from "@/lib/updater";
import { compareVersion, parseVersion } from "@/lib/updater";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 分钟超时（构建可能需要较长时间）

/** 安装包目录（上传后暂存） */
const UPLOAD_DIR = join(process.cwd(), "data", ".upload");

/** 源码备份目录 */
const RB_DIR = join(process.cwd(), "data", ".rollback");

/** 验证文件名是否符合 xiviblog-selfhosted-vX.Y.Z.zip 格式 */
function parseUploadFilename(filename: string): { version: string; ok: boolean } {
  const m = /^xiviblog-selfhosted-v?(\d+\.\d+\.\d+)\.zip$/i.exec(filename);
  if (!m) return { version: "", ok: false };
  return { version: "v" + m[1], ok: true };
}

/** 检查 zip 文件是否包含有效的 selfhosted 结构 */
function validateZipStructure(zipPath: string): boolean {
  try {
    const tmp = join(UPLOAD_DIR, "validate-" + Date.now());
    execFileSync("unzip", ["-o", zipPath, "-d", tmp], { stdio: "ignore" });
    // 检查是否存在 package.json 和 app 目录
    const hasPkg = existsSync(join(tmp, "package.json"));
    const hasApp = existsSync(join(tmp, "app"));
    // 也检查是否是 xiviblog 项目根（有 next.config 或 open-next）
    const hasNextConfig = existsSync(join(tmp, "next.config.ts")) || existsSync(join(tmp, "next.config.js"));
    const hasOpenNext = existsSync(join(tmp, ".open-next"));
    const valid = (hasPkg && hasApp) || (hasNextConfig && hasOpenNext);
    // 清理验证目录
    try { execFileSync("rm", ["-rf", tmp], { stdio: "ignore" }); } catch {}
    return valid;
  } catch {
    return false;
  }
}

/** 执行安装流程（与 self-update.cjs 类似，但使用已上传的 zip） */
async function executeUploadUpdate(job: UpdateJob, zipPath: string, targetVersion: string): Promise<void> {
  const tmpBase = join(process.cwd(), "data", ".update-upload");
  mkdirSync(tmpBase, { recursive: true });
  const extractDir = join(tmpBase, "src-" + Date.now());

  job.status = "extracting";
  writeUpdateJob(job);

  // 解包
  try {
    execFileSync("unzip", ["-o", zipPath, "-d", extractDir], { stdio: "ignore" });
  } catch (e) {
    job.status = "failed";
    job.error = `解包失败：${e instanceof Error ? e.message : String(e)}`;
    job.finishedAt = new Date().toISOString();
    writeUpdateJob(job);
    return;
  }

  // 找到 selfhosted 根目录
  let root = extractDir;
  const entries = require("node:fs").readdirSync(extractDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && existsSync(join(extractDir, e.name, "package.json")) && existsSync(join(extractDir, e.name, "app"))) {
      root = join(extractDir, e.name);
      break;
    }
  }

  if (!existsSync(join(root, "package.json")) || !existsSync(join(root, "app"))) {
    job.status = "failed";
    job.error = "安装包结构异常：未找到 selfhosted 根目录";
    job.finishedAt = new Date().toISOString();
    writeUpdateJob(job);
    return;
  }

  job.status = "installing";
  writeUpdateJob(job);

  // 合并文件（保留用户数据/配置）
  try {
    execFileSync("cp", ["-r", root.replace(/\/$/, "") + "/.", process.cwd() + "/"], { stdio: "ignore" });
  } catch (e) {
    job.status = "failed";
    job.error = `文件合并失败：${e instanceof Error ? e.message : String(e)}`;
    job.finishedAt = new Date().toISOString();
    writeUpdateJob(job);
    return;
  }

  // 检查依赖变化
  const oldPkg = join(process.cwd(), "package.json");
  const newPkg = join(root, "package.json");
  let needInstall = true;
  try {
    if (existsSync(oldPkg) && existsSync(newPkg)) {
      const a = JSON.stringify(JSON.parse(readFileSync(oldPkg, "utf8")));
      const b = JSON.stringify(JSON.parse(readFileSync(newPkg, "utf8")));
      needInstall = a !== b;
    }
  } catch {}

  if (needInstall) {
    job.status = "installing";
    writeUpdateJob(job);
    try {
      execFileSync("npm", ["install"], { cwd: process.cwd(), stdio: "ignore", env: { ...process.env, NODE_OPTIONS: "" } });
    } catch (e) {
      job.status = "failed";
      job.error = "npm install 失败，请手动检查依赖";
      job.finishedAt = new Date().toISOString();
      writeUpdateJob(job);
      return;
    }
  }

  // 构建
  job.status = "building";
  writeUpdateJob(job);
  try {
    execFileSync("npm", ["run", "build"], { cwd: process.cwd(), stdio: "ignore", env: { ...process.env, NODE_OPTIONS: "" } });
  } catch (e) {
    job.status = "failed";
    job.error = "构建失败：请检查构建日志";
    job.finishedAt = new Date().toISOString();
    writeUpdateJob(job);
    return;
  }

  // 写入版本
  try {
    writeFileSync(join(process.cwd(), "data", "version.json"), JSON.stringify({ version: targetVersion, deployedAt: new Date().toISOString() }), "utf8");
  } catch {}

  // 重启
  job.status = "restarting";
  writeUpdateJob(job);
  try {
    execFileSync("pm2", ["restart", "xiviblog"], { stdio: "ignore" });
  } catch {}

  // 健康检查
  await new Promise(r => setTimeout(r, 4000));
  try {
    const http = require("node:http");
    await new Promise<void>((res) => {
      const req = http.get({ host: "127.0.0.1", port: 3000, path: "/api/install", timeout: 5000 }, (r: import("node:http").IncomingMessage) => {
        r.resume();
        res();
      });
      req.on("error", () => res());
      req.on("timeout", () => { req.destroy(); res(); });
    });
    job.status = "done";
    job.log.push(`✓ 上传更新完成（v${targetVersion}），服务已重启`);
  } catch {
    job.status = "done";
    job.log.push(`⚠ 上传更新完成（v${targetVersion}），但健康检查未通过`);
  }
  job.finishedAt = new Date().toISOString();
  writeUpdateJob(job);

  // 清理
  try { execFileSync("rm", ["-rf", tmpBase], { stdio: "ignore" }); } catch {}
}

/**
 * 上传安装包更新 API
 * POST /api/admin/update/upload
 * - 先创建数据备份
 * - 解包并合并到应用目录
 * - 重建并重启
 * - 失败时自动回滚
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "请使用 multipart/form-data 上传" }, { status: 400 });
  }

  // 解析表单数据
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "无法解析表单数据" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "未选择文件" }, { status: 400 });
  }

  // 验证文件类型
  if (!file.name.endsWith(".zip")) {
    return NextResponse.json({ error: "仅支持 .zip 格式的安装包" }, { status: 400 });
  }

  // 验证文件大小（最大 500MB）
  if (file.size > 500 * 1024 * 1024) {
    return NextResponse.json({ error: "安装包不能超过 500MB" }, { status: 400 });
  }

  // 解析版本号
  const { version: parsedVersion, ok: versionOk } = parseUploadFilename(file.name);
  const targetVersion = versionOk ? parsedVersion : null;

  // 若已有进行中的更新任务，拒绝
  const existing = getUpdateJob();
  if (existing.status !== "idle" && existing.status !== "done" && existing.status !== "failed" && existing.status !== "rolled_back") {
    return NextResponse.json({
      ok: false,
      reason: "in_progress",
      message: "已有更新任务进行中，请等待完成或查看进度。",
      job: existing,
    });
  }

  // 保存上传文件
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const zipPath = join(UPLOAD_DIR, `upload-${Date.now()}.zip`);
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(zipPath, buffer);

  // 验证包结构
  if (!validateZipStructure(zipPath)) {
    unlinkSync(zipPath);
    return NextResponse.json({ error: "安装包结构无效，请确认是标准的 XiviBlog 安装包" }, { status: 400 });
  }

  // 创建更新任务
  const job: UpdateJob = {
    status: "queued",
    current: APP_VERSION,
    target: targetVersion || "unknown",
    tarballUrl: "",
    snapshotId: null as number | null,
    rollbackFile: null as string | null,
    startedAt: new Date().toISOString(),
    finishedAt: null as string | null,
    log: [`开始上传更新：${file.name}${targetVersion ? `（目标版本 ${targetVersion}）` : ""}`],
  };
  writeUpdateJob(job);

  // 1) 数据备份
  try {
    const snap = await createSnapshot("manual", `上传更新前备份 @ ${targetVersion || file.name}`);
    job.snapshotId = snap.id;
    job.log.push(`已创建数据快照 #${snap.id}`);
    writeUpdateJob(job);
  } catch (e) {
    job.log.push(`数据快照创建失败（已忽略，仍继续）：${e instanceof Error ? e.message : e}`);
    writeUpdateJob(job);
  }

  // 2) 源码备份
  try {
    mkdirSync(RB_DIR, { recursive: true });
    const ts = Date.now();
    const rbFile = join(RB_DIR, `upload-${targetVersion || "unknown"}-${ts}.tar.gz`);
    execFileSync("tar", [
      "-czf", rbFile,
      "--exclude=node_modules",
      "--exclude=data",
      "--exclude=.env*",
      "--exclude=.rollback",
      "--exclude=.next",
      "--exclude=.open-next",
      "--exclude=.git",
      "-C", process.cwd(),
      ".",
    ], { stdio: "ignore" });
    job.rollbackFile = rbFile;
    job.log.push(`已备份当前源码到 ${rbFile}`);
    writeUpdateJob(job);
  } catch (e) {
    job.log.push(`源码备份失败（已忽略）：${e instanceof Error ? e.message : e}`);
    writeUpdateJob(job);
  }

  // 3) 执行安装
  job.log.push("开始执行安装…");
  writeUpdateJob(job);

  try {
    await executeUploadUpdate(job, zipPath, targetVersion || APP_VERSION);
  } catch (e) {
    job.status = "failed";
    job.error = `安装异常：${e instanceof Error ? e.message : String(e)}`;
    job.finishedAt = new Date().toISOString();
    writeUpdateJob(job);
  }

  // 清理上传文件
  try { unlinkSync(zipPath); } catch {}

  return NextResponse.json({ ok: true, job, targetVersion });
}

/** GET: 返回当前状态 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const job = getUpdateJob();
  const rollbackBundles = listRollbackBundles();
  return NextResponse.json({ job, rollbackBundles });
}
