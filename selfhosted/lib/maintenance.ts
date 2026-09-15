import { allowOnce, getJob, jobDue, markJob, type JobRow } from "./runtime";
import { autoBackupJob } from "./snapshot";
import { checkFriendsJob, pruneOrphanChecks } from "./friends";
import { purgeOldSearches, purgeOldViews } from "./db";
import { purgeOldFeedHits } from "./feed";

/* ==========================================================================
 * 心跳调度器
 *
 * 挂在前台访问埋点（/api/track）上：每来一次访问就顺手看一眼「有没有任务到期」。
 *   · 进程内节流（10 分钟）先挡掉绝大多数请求，正常访问连一次 D1 都不查；
 *   · 再查 jobs 表判断是否真的到期（24 小时 / 7 天）；
 *   · 真正跑任务时用 waitUntil，绝不拖慢访客。
 * 结果就是「不用配 cron 也能每天自动备份 + 自动检测友链」。
 * ========================================================================== */

export const JOB_KEY = {
  backup: "auto_backup",
  friends: "friend_check",
  cleanup: "cleanup",
} as const;

/** 各任务的执行间隔（小时） */
export const JOB_HOURS = {
  backup: 24,
  friends: 24,
  cleanup: 24 * 7,
} as const;

/** 进程内节流窗口：同一 isolate 10 分钟内最多查一次到期 */
const GATE_MS = 10 * 60_000;

async function runStep(
  key: string,
  hours: number,
  fn: () => Promise<string>
): Promise<string> {
  try {
    if (!(await jobDue(key, hours))) return "not-due";
    const status = await fn();
    await markJob(key, status);
    return status;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 失败也记录：否则每次访问都会重试同一个坏任务
    await markJob(key, `err: ${msg}`.slice(0, 190));
    return `err: ${msg}`;
  }
}

/**
 * 心跳：到期才跑。任何异常都在内部消化，绝不影响访客请求。
 * 调用方用 runInBackground(heartbeat()) 挂到 waitUntil 上。
 */
export async function heartbeat(): Promise<void> {
  if (!allowOnce("xivi-heartbeat", GATE_MS)) return;

  await runStep(JOB_KEY.backup, JOB_HOURS.backup, async () => {
    const r = await autoBackupJob();
    return r.skipped ? "skip（内容未变化）" : `ok ${r.posts} 篇`;
  });

  await runStep(JOB_KEY.friends, JOB_HOURS.friends, async () => {
    const r = await checkFriendsJob();
    return r.checked === 0 ? "skip（无需检测）" : `ok ${r.checked} 条 / 异常 ${r.bad}`;
  });

  await runStep(JOB_KEY.cleanup, JOB_HOURS.cleanup, async () => {
    const [pv, search, feed, orphans] = await Promise.all([
      purgeOldViews(180),
      purgeOldSearches(365),
      purgeOldFeedHits(365),
      pruneOrphanChecks(),
    ]);
    return `ok 清理 pv:${pv} search:${search} feed:${feed} friend-orphan:${orphans}`;
  });
}

export type JobStatus = {
  key: string;
  label: string;
  hours: number;
  last_run: string;
  last_status: string;
  runs: number;
};

const LABELS: Record<string, string> = {
  [JOB_KEY.backup]: "自动备份",
  [JOB_KEY.friends]: "友链存活检测",
  [JOB_KEY.cleanup]: "数据清理",
};

export async function listJobStatus(): Promise<JobStatus[]> {
  const keys: [string, number][] = [
    [JOB_KEY.backup, JOB_HOURS.backup],
    [JOB_KEY.friends, JOB_HOURS.friends],
    [JOB_KEY.cleanup, JOB_HOURS.cleanup],
  ];
  const rows = await Promise.all(keys.map(([k]) => getJob(k)));
  return keys.map(([k, hours], i) => {
    const r: JobRow | null = rows[i];
    return {
      key: k,
      label: LABELS[k] ?? k,
      hours,
      last_run: r?.last_run ?? "",
      last_status: r?.last_status ?? "",
      runs: r?.runs ?? 0,
    };
  });
}
