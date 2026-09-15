import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listAll } from "@/lib/db";
import {
  getSnapshotStats,
  listSnapshots,
  type SnapshotMeta,
  type SnapshotStats,
} from "@/lib/snapshot";
import { listJobStatus, type JobStatus } from "@/lib/maintenance";
import AdminNav from "../admin-nav";
import LogoutButton from "../logout-button";
import BackupClient from "./backup-client";
import SnapshotPanel from "./snapshot-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "数据备份" };

const EMPTY_STATS: SnapshotStats = {
  total: 0,
  auto: 0,
  manual: 0,
  bytes: 0,
  lastAutoAt: "",
  lastManualAt: "",
  lastSignature: "",
};

export default async function BackupPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  let count = 0;
  let snapshots: SnapshotMeta[] = [];
  let stats: SnapshotStats = EMPTY_STATS;
  let jobs: JobStatus[] = [];
  let dbError = "";

  try {
    const [all, snaps, st, jb] = await Promise.all([
      listAll(),
      listSnapshots(30),
      getSnapshotStats(),
      listJobStatus(),
    ]);
    count = all.length;
    snapshots = snaps;
    stats = st;
    jobs = jb;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-6 py-12">
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] px-4 py-3">
        <p className="text-sm text-[var(--c-text-2)]">
          导出 / 导入站点数据，建议每次大改前先备份一次。
        </p>
        <LogoutButton />
      </div>

      <AdminNav current="/admin/backup" />

      <h1 className="mb-2 text-2xl font-bold text-[var(--c-text)]">数据备份</h1>
      <p className="mb-6 text-sm text-[var(--c-text-3)]">
        两条链路：<b className="text-[var(--c-text-2)]">站点快照</b>留在数据库里随时回滚，
        <b className="text-[var(--c-text-2)]">导出文件</b>下载到本地防灾。
      </p>

      {dbError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      )}

      <BackupClient postCount={count} />

      <SnapshotPanel
        initialSnapshots={snapshots}
        initialStats={stats}
        initialJobs={jobs}
      />
    </div>
  );
}
