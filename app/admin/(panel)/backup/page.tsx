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
    <>
      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-0">
        <h1 className="text-base font-semibold text-white pl-[2em]">数据备份</h1>
      </div>

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
    </>
  );
}
