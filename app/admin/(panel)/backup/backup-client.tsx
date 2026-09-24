"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackupFile } from "@/lib/backup";
import { useConfirm } from "../use-confirm";

type Msg = { type: "ok" | "err"; text: string } | null;

export default function BackupClient({ postCount }: { postCount: number }) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [withSettings, setWithSettings] = useState(true);

  async function exportNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name =
        /filename="([^"]+)"/.exec(cd)?.[1] || `xivi-blog-backup-${Date.now()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({
        type: "ok",
        text: `已导出 ${(blob.size / 1024).toFixed(0)} KB，文件名 ${name}`,
      });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    setMsg(null);
    try {
      const text = await f.text();
      const data = JSON.parse(text) as BackupFile;
      if (!data || !Array.isArray(data.posts)) {
        throw new Error("不是本系统导出的备份文件");
      }
      setPending(data);
      setMsg({
        type: "ok",
        text: `已读取备份：${data.posts.length} 篇 · 导出于 ${
          data.exportedAt?.slice(0, 19).replace("T", " ") || "未知时间"
        }`,
      });
    } catch (err) {
      setPending(null);
      setMsg({
        type: "err",
        text: `读取失败：${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  async function runImport(mode: "merge" | "replace") {
    if (!pending) return;
    const ok = await ask({
      title: mode === "replace" ? "覆盖导入" : "合并导入",
      message:
        mode === "replace"
          ? `将先清空现有 ${postCount} 篇文章，再导入备份里的 ${pending.posts.length} 篇。此操作不可撤销，建议先导出一次当前数据。`
          : `按 slug 匹配：同名文章会被备份覆盖，其余保留。共 ${pending.posts.length} 篇。`,
      danger: mode === "replace",
      okText: mode === "replace" ? "清空并导入" : "开始导入",
    });
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, withSettings, data: pending }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        inserted?: number;
        updated?: number;
      };
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg({
        type: "ok",
        text: `导入完成：新增 ${j.inserted ?? 0} 篇，覆盖 ${j.updated ?? 0} 篇${
          withSettings ? "，站点设置已恢复" : ""
        }`,
      });
      setPending(null);
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-lg border border-[var(--c-border-3)] px-4 py-2 text-sm font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";

  return (
    <div>
      {dialog}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 导出 */}
        <section className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-5">
          <h2 className="text-base font-semibold text-[var(--c-text)]">导出备份</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--c-text-3)]">
            把全部 {postCount} 篇文章（含草稿、置顶、定时设置）与站点设置打包成一个
            JSON 文件下载到本地。换电脑、换域名、误删找回都靠它。
          </p>
          <button
            type="button"
            onClick={exportNow}
            disabled={busy}
            className="mt-4 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            {busy ? "处理中…" : "下载备份文件"}
          </button>
        </section>

        {/* 导入 */}
        <section className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-5">
          <h2 className="text-base font-semibold text-[var(--c-text)]">导入备份</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--c-text-3)]">
            选择之前导出的 JSON 文件。合并导入会按 slug 覆盖同名文章，不影响其他内容；
            覆盖导入会先清空当前全部文章。
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={pickFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className={btn}
            >
              选择备份文件
            </button>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-[var(--c-text-2)]">
              <input
                type="checkbox"
                checked={withSettings}
                onChange={(e) => setWithSettings(e.target.checked)}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              一并恢复站点设置
            </label>
          </div>

          {pending && (
            <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-[var(--brand)] bg-[var(--c-brand-soft)] p-3">
              <span className="w-full text-xs text-[var(--brand-deep)]">
                待导入 {pending.posts.length} 篇
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => runImport("merge")}
                className="rounded-lg border border-[var(--c-border-3)] bg-[var(--c-card)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] disabled:opacity-40"
              >
                合并导入
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runImport("replace")}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40"
              >
                清空并覆盖导入
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="ml-auto text-xs text-[var(--c-text-3)] hover:text-[var(--c-text-2)]"
              >
                取消
              </button>
            </div>
          )}
        </section>
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

      <p className="mt-6 rounded-lg border border-dashed border-[var(--c-border-3)] px-4 py-3 text-xs leading-6 text-[var(--c-text-3)]">
        提示：访问统计明细（page_views）与封面等媒体文件不在备份范围内 ——
        封面图若以 base64 内嵌在文章里会随备份一起导出，媒体库里的外链图片请自行留存原始文件。
      </p>
    </div>
  );
}
