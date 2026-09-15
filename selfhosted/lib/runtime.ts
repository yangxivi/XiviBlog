import { getDB } from "./db";

/* ==========================================================================
 * 运行期小工具：后台任务 + 惰性定时调度
 *
 * Workers 没有常驻进程。本项目刻意不引 Cron Trigger（要自定义 worker 入口，
 * 会和 OpenNext 生成的 .open-next/worker.js 打架），改用「心跳 + 到期判断」：
 * 前台每来一次访问就顺带看一眼哪些任务到期，到期才执行。
 * ========================================================================== */

/** 把 Promise 交给后台执行（自托管为长驻 Node 进程，直接等待即可） */
export async function runInBackground(task: Promise<unknown>): Promise<void> {
  await task.catch(() => {});
}

/* --------------------------- 进程内节流 --------------------------- */

const gate = new Map<string, number>();

/**
 * 同一 isolate 内 N 毫秒只放行一次。
 * Worker isolate 会被复用，所以绝大多数请求连一次 D1 都不用查，
 * 真正把「检查是否到期」的成本压到了接近 0。
 */
export function allowOnce(key: string, ms: number): boolean {
  const now = Date.now();
  const last = gate.get(key) ?? 0;
  if (now - last < ms) return false;
  gate.set(key, now);
  return true;
}

/* ---------------------------- 任务表 ---------------------------- */

export type JobRow = {
  key: string;
  last_run: string;
  last_status: string;
  runs: number;
};

/** 这个任务距上次执行是否已超过 hours 小时（没记录过 = 到期） */
export async function jobDue(key: string, hours: number): Promise<boolean> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT last_run FROM jobs WHERE key=?1")
      .bind(key)
      .first<{ last_run: string }>();
    if (!row?.last_run) return true;
    const t = Date.parse(row.last_run.replace(" ", "T") + "Z");
    if (Number.isNaN(t)) return true;
    return Date.now() - t >= hours * 3600_000;
  } catch {
    // 查不到就当作没到期：宁可少跑一次，也不要在异常时反复打库
    return false;
  }
}

/** 记录一次执行（成功失败都记，避免失败任务被无限重试打爆） */
export async function markJob(key: string, status = "ok"): Promise<void> {
  try {
    const db = await getDB();
    await db
      .prepare(
        "INSERT INTO jobs (key, last_run, last_status, runs) VALUES (?1, datetime('now'), ?2, 1) " +
          "ON CONFLICT(key) DO UPDATE SET last_run=datetime('now'), last_status=?2, runs=runs+1"
      )
      .bind(key, status.slice(0, 200))
      .run();
  } catch {
    /* 记录失败不影响任务本身 */
  }
}

export async function getJob(key: string): Promise<JobRow | null> {
  try {
    const db = await getDB();
    return (
      (await db
        .prepare("SELECT key, last_run, last_status, runs FROM jobs WHERE key=?1")
        .bind(key)
        .first<JobRow>()) ?? null
    );
  } catch {
    return null;
  }
}
