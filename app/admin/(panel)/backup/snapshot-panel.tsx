"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "../use-confirm";

export type SnapshotMeta = {
  id: number;
  kind: "auto" | "manual";
  note: string;
  posts: number;
  bytes: number;
  signature: string;
  created_at: string;
};

export type SnapshotStats = {
  total: number;
  auto: number;
  manual: number;
  bytes: number;
  lastAutoAt: string;
  lastManualAt: string;
  lastSignature: string;
};

export type JobStatus = {
  key: string;
  label: string;
  hours: number;
  last_run: string;
  last_status: string;
  runs: number;
};

type Msg = { type: "ok" | "err"; text: string } | null;

const BTN =
  "rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";
const DANGER =
  "rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40";

function cnTime(utc: string): string {
  if (!utc) return "—";
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return utc;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function size(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 距下次自动备份还有多久 */
function nextRun(lastRun: string, hours: number): string {
  if (!lastRun) return "等待首次触发";
  const t = Date.parse(lastRun.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return "—";
  const left = t + hours * 3600_000 - Date.now();
  if (left <= 0) return "下次访问站点时执行";
  const h = Math.floor(left / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  return h > 0 ? `${h} 小时 ${m} 分后` : `${m} 分钟后`;
}

export default function SnapshotPanel({
  initialSnapshots,
  initialStats,
  initialJobs,
}: {
  initialSnapshots: SnapshotMeta[];
  initialStats: SnapshotStats;
  initialJobs: JobStatus[];
}) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>(initialSnapshots);
  const [stats, setStats] = useState<SnapshotStats>(initialStats);
  const [jobs, setJobs] = useState<JobStatus[]>(initialJobs);
  const [busyId, setBusyId] = useState(0);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const backupJob = jobs.find((j) => j.key === "auto_backup");

  async function reload() {
    const res = await fetch("/api/backups");
    const j = (await res.json().catch(() => null)) as {
      ok?: boolean;
      snapshots?: SnapshotMeta[];
      stats?: SnapshotStats;
      jobs?: JobStatus[];
    } | null;
    if (j?.ok) {
      setSnapshots(j.snapshots ?? []);
      setStats(j.stats ?? initialStats);
      setJobs(j.jobs ?? []);
    }
  }

  async function createNow() {
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        created?: { posts: number; skipped: boolean };
        snapshots?: SnapshotMeta[];
        stats?: SnapshotStats;
      };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setSnapshots(j.snapshots ?? []);
      setStats(j.stats ?? stats);
      setMsg({
        type: "ok",
        text: `已创建快照，共 ${j.created?.posts ?? 0} 篇`,
      });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreating(false);
    }
  }

  async function restore(s: SnapshotMeta, mode: "merge" | "replace") {
    const ok = await ask({
      title: mode === "replace" ? "覆盖恢复" : "合并恢复",
      message:
        mode === "replace"
          ? `将先清空当前全部文章，再写入快照 #${s.id}（${cnTime(s.created_at)}，${s.posts} 篇）。恢复前系统会自动存一份「恢复前快照」兜底。`
          : `按 slug 合并：快照 #${s.id} 里的文章会覆盖同名文章，其余保留。是否同时恢复站点设置可在下方选择。`,
      danger: mode === "replace",
      okText: mode === "replace" ? "清空并恢复" : "开始恢复",
    });
    if (!ok) return;

    setBusyId(s.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/backups/${s.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, withSettings: false }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        inserted?: number;
        updated?: number;
        safetySnapshotId?: number | null;
      };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({
        type: "ok",
        text: `已从快照 #${s.id} 恢复：新增 ${j.inserted ?? 0} 篇，覆盖 ${j.updated ?? 0} 篇${
          j.safetySnapshotId ? `（恢复前已存档为 #${j.safetySnapshotId}）` : ""
        }`,
      });
      await reload();
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyId(0);
    }
  }

  async function remove(s: SnapshotMeta) {
    const ok = await ask({
      title: "删除快照",
      message: `确定删除快照 #${s.id}（${cnTime(s.created_at)}，${s.posts} 篇）？删除后无法找回。`,
      danger: true,
      okText: "删除",
    });
    if (!ok) return;

    setBusyId(s.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/backups/${s.id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !j.ok) throw new Error(`HTTP ${res.status}`);
      await reload();
      setMsg({ type: "ok", text: `已删除快照 #${s.id}` });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyId(0);
    }
  }

  return (
    <section className="mt-8">
      {dialog}

      <div className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--c-text)]">
              自动备份（站点快照）
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--c-text-3)]">
              每隔 {backupJob?.hours ?? 24} 小时自动存一份快照，
              <b className="text-[var(--c-text-2)]">内容没有变化就不重复存</b>
              ，保留最近 7 份自动 + 5 份手动。快照存在数据库里，误删文章、
              改坏排版都能直接回到某个时间点，不必依赖本地文件。
            </p>
            <p className="mt-1.5 text-xs text-[var(--c-text-4)]">
              上次自动备份 {cnTime(backupJob?.last_run || "")} · 下次{" "}
              {nextRun(backupJob?.last_run || "", backupJob?.hours ?? 24)} · 已执行{" "}
              {backupJob?.runs ?? 0} 次 · 当前 {stats.auto} 份自动 /{" "}
              {stats.manual} 份手动（合计 {size(stats.bytes)}）
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className={BTN} onClick={reload} disabled={creating}>
              刷新
            </button>
            <button
              onClick={createNow}
              disabled={creating}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              {creating ? "备份中…" : "立即备份"}
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${
              msg.type === "ok"
                ? "border-[var(--c-border-2)] bg-[var(--c-soft)] text-[var(--c-text-2)]"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--c-border-2)] text-xs text-[var(--c-text-3)]">
                <th className="pb-2 pr-4 font-medium">时间</th>
                <th className="pb-2 pr-4 font-medium">类型</th>
                <th className="pb-2 pr-4 font-medium">说明</th>
                <th className="pb-2 pr-4 font-medium">篇数</th>
                <th className="pb-2 pr-4 font-medium">体积</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[var(--c-border)] last:border-0"
                >
                  <td className="whitespace-nowrap py-2.5 pr-4 text-xs tabular-nums text-[var(--c-text-2)]">
                    {cnTime(s.created_at)}
                    <span className="ml-1.5 text-[var(--c-text-4)]">#{s.id}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        s.kind === "auto"
                          ? "bg-[var(--c-brand-tint)] text-[var(--brand-deep)]"
                          : "bg-[var(--c-fill)] text-[var(--c-text-2)]"
                      }`}
                    >
                      {s.kind === "auto" ? "自动" : "手动"}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate py-2.5 pr-4 text-xs text-[var(--c-text-3)]">
                    {s.note || "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-xs tabular-nums text-[var(--c-text-2)]">
                    {s.posts}
                  </td>
                  <td className="py-2.5 pr-4 text-xs tabular-nums text-[var(--c-text-3)]">
                    {size(s.bytes)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a className={BTN} href={`/api/backups/${s.id}`}>
                        下载
                      </a>
                      <button
                        className={BTN}
                        disabled={busyId === s.id}
                        onClick={() => restore(s, "merge")}
                      >
                        合并恢复
                      </button>
                      <button
                        className={DANGER}
                        disabled={busyId === s.id}
                        onClick={() => restore(s, "replace")}
                      >
                        覆盖恢复
                      </button>
                      <button
                        className={DANGER}
                        disabled={busyId === s.id}
                        onClick={() => remove(s)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-[var(--c-text-4)]"
                  >
                    还没有快照。点「立即备份」立刻存一份，之后系统每 24 小时自动存一次。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 border-t border-[var(--c-border-2)] pt-3 text-xs leading-6 text-[var(--c-text-4)]">
          快照只包含文章与站点设置（与「下载备份文件」同一份格式，可以互相导入）。
          访问统计明细、搜索词、媒体库外链图片不在快照内。
        </p>
      </div>
    </section>
  );
}
