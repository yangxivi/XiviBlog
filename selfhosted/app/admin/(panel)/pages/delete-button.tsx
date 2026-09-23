"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePageButton({
  id,
  title,
}: {
  id: number;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`确定删除页面「${title}」？不可恢复。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error || "删除失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "删除中…" : "删除"}
    </button>
  );
}
