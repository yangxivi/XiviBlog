import { NextRequest, NextResponse } from "next/server";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createSnapshot } from "@/lib/snapshot";
import { APP_VERSION } from "@/lib/version";
import {
  checkUpdate,
  getUpdateJob,
  writeUpdateJob,
  listRollbackBundles,
  readDeployedVersion,
  type UpdateJob,
} from "@/lib/updater";

export const dynamic = "force-dynamic";

/** 自动检测节流：开启自动检测时，最多每 6 小时真正打一次 GitHub */
const AUTO_CHECK_INTERVAL = 6 * 3600 * 1000;

function readCheckCache(): {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  checkedAt: string;
} | null {
  try {
    const p = join(process.cwd(), "data", "update-check.json");
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf8"));
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function resolveCheck(force: boolean): Promise<{
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  release: unknown;
  checkedAt: string;
}> {
  const token = process.env.GITHUB_TOKEN;
  const cache = readCheckCache();
  const settings = await getSettings().catch(() => null);
  const auto = settings?.autoUpdate === true;
  const fresh =
    cache && Date.now() - new Date(cache.checkedAt).getTime() < AUTO_CHECK_INTERVAL;
  if (!force && auto && fresh && cache) {
    return {
      current: cache.current,
      latest: cache.latest,
      hasUpdate: cache.hasUpdate,
      release: null,
      checkedAt: cache.checkedAt,
    };
  }
  return checkUpdate(token, true);
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const check = await resolveCheck(force);
  const job = getUpdateJob();
  const rollbackBundles = listRollbackBundles();
  return NextResponse.json({
    version: APP_VERSION,
    deployed: readDeployedVersion(),
    check,
    job,
    rollbackBundles,
  });
}

/** 触发一次在线更新（前置：更新前自动双备份） */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 解析请求：可带 { force?: boolean }
  const body = (await req.json().catch(() => null)) as { force?: boolean } | null;

  const check = await resolveCheck(body?.force === true);
  if (!check.hasUpdate || !check.release) {
    return NextResponse.json({
      ok: false,
      reason: "latest",
      current: check.current,
      latest: check.latest,
      message: "当前已是最新版本，无需更新。",
    });
  }
  const release = check.release as {
    tag: string;
    tarballUrl: string;
    notes: string;
  };

  // 若已有进行中的更新任务，拒绝重复触发
  const existing = getUpdateJob();
  if (existing.status !== "idle" && existing.status !== "done" && existing.status !== "failed" && existing.status !== "rolled_back") {
    return NextResponse.json({
      ok: false,
      reason: "in_progress",
      message: "已有更新任务进行中，请等待完成或查看进度。",
      job: existing,
    });
  }

  const job: UpdateJob = {
    status: "queued",
    current: APP_VERSION,
    target: release.tag,
    tarballUrl: release.tarballUrl,
    snapshotId: null,
    rollbackFile: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    log: [`检测到新版本 ${release.tag}，准备更新（当前 ${APP_VERSION}）`],
  };
  writeUpdateJob(job);

  // 1) 数据备份：打一份「更新前」快照（应用仍存活，可安全写库）
  try {
    const snap = await createSnapshot("manual", `更新前自动备份 @ ${release.tag}`);
    job.snapshotId = snap.id;
    job.log.push(`已创建数据快照 #${snap.id}`);
    writeUpdateJob(job);
  } catch (e) {
    job.log.push(`数据快照创建失败（已忽略，仍继续）：${e instanceof Error ? e.message : e}`);
    writeUpdateJob(job);
  }

  // 2) 源码备份：把当前源码打成 tar.gz 存到 data/.rollback（供失败/手动回滚）
  try {
    const ts = Date.now();
    const rbDir = join(process.cwd(), "data", ".rollback");
    mkdirSync(rbDir, { recursive: true });
    const rbFile = join(rbDir, `app-${APP_VERSION}-${ts}.tar.gz`);
    execFileSync(
      "tar",
      [
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
      ],
      { stdio: "ignore" }
    );
    job.rollbackFile = rbFile;
    job.log.push(`已备份当前源码到 ${rbFile}`);
    writeUpdateJob(job);
  } catch (e) {
    job.log.push(`源码备份失败（已忽略）：${e instanceof Error ? e.message : e}`);
    writeUpdateJob(job);
  }

  // 3) 派生 detached 更新进程：它会下载→解包→构建→重启，即使本进程被 pm2 重启也不中断
  try {
    const script = join(process.cwd(), "scripts", "self-update.cjs");
    const child = spawn("node", [script], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
    job.log.push("已启动后台更新进程，正在下载新版本…");
    writeUpdateJob(job);
  } catch (e) {
    job.status = "failed";
    job.error = `启动更新进程失败：${e instanceof Error ? e.message : e}`;
    job.finishedAt = new Date().toISOString();
    job.log.push(job.error);
    writeUpdateJob(job);
    return NextResponse.json({ ok: false, error: job.error, job });
  }

  return NextResponse.json({ ok: true, job, check });
}
