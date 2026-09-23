"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirm } from "../use-confirm";

type Check = {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  checkedAt: string;
};
type Job = {
  status: string;
  current: string;
  target: string;
  startedAt: string | null;
  finishedAt: string | null;
  log: string[];
  error?: string;
};
type Bundle = { file: string; version: string; at: string };
type Data = {
  version: string;
  deployed: string;
  check: Check;
  job: Job;
  rollbackBundles: Bundle[];
};

const STATUS_TEXT: Record<string, string> = {
  idle: "空闲",
  queued: "已排队",
  backing_up: "备份中",
  downloading: "下载中",
  extracting: "解包中",
  installing: "安装依赖中",
  building: "构建中",
  restarting: "重启中",
  done: "更新完成",
  failed: "更新失败",
  rolled_back: "已回滚",
};

const IN_PROGRESS = ["queued", "backing_up", "downloading", "extracting", "installing", "building", "restarting"];

export default function UpdatePanel() {
  const { ask, dialog } = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedBundle, setSelectedBundle] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const res = await fetch("/api/admin/update" + (force ? "?force=1" : ""));
      const j = await res.json();
      if (res.ok) {
        setData(j);
        if (j.rollbackBundles?.length && !selectedBundle) {
          setSelectedBundle(j.rollbackBundles[0].file);
        }
      }
    } catch {
      /* ignore */
    }
  }, [selectedBundle]);

  useEffect(() => {
    load();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  // 进度轮询：有进行中的任务时每 3 秒刷新一次
  useEffect(() => {
    const active = data?.job && IN_PROGRESS.includes(data.job.status);
    if (active) {
      if (!timer.current) {
        timer.current = setInterval(() => load(), 3000);
      }
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [data?.job?.status, load]);

  async function checkNow() {
    setBusy(true);
    setMsg(null);
    await load(true);
    setBusy(false);
    setMsg({ type: "ok", text: "已检查 GitHub 最新版本。" });
  }

  async function doUpdate() {
    const ok = await ask({
      title: "确认在线更新",
      message:
        "将自动备份当前数据与源码，然后从 GitHub 下载新版本并重建。整个过程约 1–3 分钟，期间站点会短暂重启。是否继续？",
      danger: false,
      okText: "开始更新",
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      setMsg({ type: "ok", text: "已启动后台更新，请留意下方进度。" });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function doRollback() {
    if (!selectedBundle) {
      setMsg({ type: "err", text: "请先选择要回滚到的源码备份。" });
      return;
    }
    const ok = await ask({
      title: "回滚到上一版本",
      message:
        "将用选中的源码备份恢复程序文件并重建重启。若勾选了数据快照 ID，还会一并恢复当时的文章数据。此操作会重启站点。是否继续？",
      danger: true,
      okText: "确认回滚",
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/update/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: selectedBundle,
          snapshotId: snapshotId ? Number(snapshotId) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({ type: "ok", text: "已启动回滚，请稍候刷新查看结果。" });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteBackup() {
    if (!selectedBundle) return;
    const ok = await ask({
      title: "删除备份",
      message: `确认删除源码备份 v${data?.rollbackBundles.find(b => b.file === selectedBundle)?.version || "未知"}？此操作不可恢复。`,
      danger: true,
      okText: "删除",
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const fileName = selectedBundle.split("/").pop() || "";
      const res = await fetch("/api/admin/update/rollback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileName }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({ type: "ok", text: "备份已删除" });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);

    // 验证文件名格式：支持 xiviblog-selfhosted-vX.Y.Z.zip 或 XiviBlog-vX.Y.Z-selfhosted.zip
    const m = /^xiviblog-selfhosted-v?(\d+\.\d+\.\d+)\.zip$|^XiviBlog-v(\d+\.\d+\.\d+)-selfhosted\.zip$/i.exec(file.name);
    if (!m) {
      setMsg({ type: "err", text: `文件名格式不对，期望 xiviblog-selfhosted-vX.Y.Z.zip 或 XiviBlog-vX.Y.Z-selfhosted.zip，实际：${file.name}` });
      setUploadFile(null);
      return;
    }

    const version = "v" + (m[1] || m[2]);
    setMsg({ type: "ok", text: `已选择安装包：${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MB）` });
  }

  async function doUploadUpdate() {
    if (!uploadFile) {
      setMsg({ type: "err", text: "请先选择安装包文件。" });
      return;
    }

    const ok = await ask({
      title: "确认上传更新",
      message: `将上传 ${uploadFile.name} 并更新到版本 ${uploadFile.name.match(/v?(\d+\.\d+\.\d+)/)?.[1]}。更新前会自动备份数据与源码，失败可回滚。整个过程约 2–5 分钟，期间站点会短暂重启。是否继续？`,
      danger: false,
      okText: "开始上传更新",
    });
    if (!ok) return;

    setUploading(true);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/admin/update/upload", {
        method: "POST",
        body: formData,
      });

      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || j.message || `HTTP ${res.status}`);
      }

      setMsg({ type: "ok", text: "已启动上传更新，请留意下方进度。" });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
  }

  const job = data?.job;
  const check = data?.check;
  const inProgress = job && IN_PROGRESS.includes(job.status);

  return (
    <div className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-6">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--c-text)]">系统更新（自托管版）</h2>
          <p className="mt-1 text-sm text-[var(--c-text-3)]">
            一键检测 GitHub 最新版本并在线更新；也支持上传安装包手动更新。更新前自动备份，失败可回滚。
          </p>
        </div>
        <span className="rounded-full border border-[var(--c-border-3)] px-3 py-1 text-xs text-[var(--c-text-2)]">
          当前版本 v{data?.version ?? "…"}（已部署 v{data?.deployed ?? "…"}）
        </span>
      </div>

      {/* 检测结果 */}
      <div className="mt-4 rounded-lg border border-[var(--c-border-2)] bg-[var(--c-soft)] p-4 text-sm">
        {check ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              最新版本：
              <b className="text-[var(--c-text)]">{check.latest ?? "未知"}</b>
            </span>
            <span className={check.hasUpdate ? "text-[var(--brand-deep)]" : "text-[var(--c-text-3)]"}>
              {check.hasUpdate
                ? "🔔 有可用更新"
                : check.latest
                ? "✓ 已是最新"
                : "GitHub 无法访问，请使用上传安装包方式更新"}
            </span>
            <span className="text-xs text-[var(--c-text-3)]">
              检测于 {check.checkedAt?.slice(0, 19).replace("T", " ") || "—"}
            </span>
          </div>
        ) : (
          <span className="text-[var(--c-text-3)]">尚未检测</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={checkNow}
          disabled={busy}
          className="rounded-lg border border-[var(--c-border-3)] px-4 py-2 text-sm font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] disabled:opacity-40"
        >
          检查更新
        </button>
        <button
          type="button"
          onClick={doUpdate}
          disabled={busy || inProgress || !check?.hasUpdate}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-50"
        >
          {inProgress ? "更新进行中…" : "立即更新"}
        </button>
      </div>

      {/* 上传安装包更新 */}
      <div className="mt-6 rounded-lg border border-dashed border-[var(--c-border-3)] p-4">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">上传安装包更新</h3>
        <p className="mt-1 text-xs leading-6 text-[var(--c-text-3)]">
          若 GitHub 无法访问或需要从本地安装包更新，可选择 <code>xiviblog-selfhosted-vX.Y.Z.zip</code> 格式的压缩包。
          更新前会自动备份数据与源码，失败可回滚。
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".zip"
              onChange={handleUpload}
              disabled={busy || inProgress}
              className="block w-full text-sm text-[var(--c-text-2)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand)] file:text-[var(--brand-ink)] file:cursor-pointer hover:file:bg-[var(--brand-hover)] disabled:file:opacity-50"
            />
          </div>
          {uploadFile && (
            <button
              type="button"
              onClick={doUploadUpdate}
              disabled={uploading || inProgress}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              {uploading ? "上传更新中…" : "开始上传更新"}
            </button>
          )}
        </div>
      </div>

      {/* 进度 */}
      {job && job.status !== "idle" && (
        <div className="mt-5 rounded-lg border border-[var(--c-border-2)] bg-[var(--c-soft)] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--c-text)]">
              状态：{STATUS_TEXT[job.status] || job.status}
              {job.target ? `（v${job.current} → v${job.target}）` : ""}
            </span>
            {job.finishedAt && (
              <span className="text-xs text-[var(--c-text-3)]">
                {job.finishedAt.slice(0, 19).replace("T", " ")}
              </span>
            )}
          </div>
          {job.log?.length > 0 && (
            <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[var(--c-code-bg,#0b1020)] p-3 text-xs leading-5 text-[var(--c-code,#d6e2ff)]">
              {job.log.join("\n")}
            </pre>
          )}
          {job.error && (
            <p className="mt-2 text-xs text-red-500">{job.error}</p>
          )}
        </div>
      )}

      {/* 回滚 */}
      <div className="mt-6 rounded-lg border border-dashed border-[var(--c-border-3)] p-4">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">回滚到上一版本</h3>
        <p className="mt-1 text-xs leading-6 text-[var(--c-text-3)]">
          更新前会自动备份源码到 <code>data/.rollback/</code>。若新版本不满意或更新失败，可从此处恢复。
        </p>
        {data?.rollbackBundles?.length ? (
          <div className="mt-3 space-y-3">
            <select
              value={selectedBundle}
              onChange={(e) => setSelectedBundle(e.target.value)}
              className="w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)]"
            >
              {data.rollbackBundles.map((b) => (
                <option key={b.file} value={b.file}>
                  源码备份 v{b.version}（{b.at ? new Date(Number(b.at)).toLocaleString() : "—"}）
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="可选：数据快照 ID（在「备份」页查看，恢复当时的文章数据）"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
            <button
              type="button"
              onClick={doRollback}
              disabled={busy || !selectedBundle}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40"
            >
              回滚到所选备份
            </button>
            <button
              type="button"
              onClick={deleteBackup}
              disabled={busy || !selectedBundle}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
            >
              删除此备份
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-[var(--c-text-3)]">暂无回滚备份（需先执行过一次更新）。</p>
        )}
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
    </div>
  );
}
