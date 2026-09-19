"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 6) return setErr("密码至少 6 位");
    if (password !== confirm) return setErr("两次输入的密码不一致");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setDone(true);
        return;
      }
      setErr(j.error || "重置失败");
    } catch {
      setErr("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm text-[var(--c-text-2)]">
          重置链接缺少校验参数，可能复制不完整。
        </p>
        <Link
          href="/admin/forgot"
          className="block w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
        >
          重新获取重置链接
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--c-brand-soft)] text-2xl">
          ✓
        </div>
        <div>
          <p className="font-semibold text-[var(--c-text)]">密码已重置</p>
          <p className="mt-1 text-sm text-[var(--c-text-3)]">
            该链接已失效，请用新密码登录。
          </p>
        </div>
        <Link
          href="/admin/login?reset=1"
          className="block w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
        >
          去登录
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          新密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
          autoComplete="new-password"
          autoFocus
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          确认新密码
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再输一次"
          autoComplete="new-password"
          className={inputCls}
        />
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "提交中…" : "设置新密码"}
      </button>

      <p className="pt-1 text-center text-sm text-[var(--c-text-3)]">
        <Link
          href="/admin/login"
          className="font-medium text-[var(--brand-deep)] transition hover:underline"
        >
          返回登录
        </Link>
      </p>
    </form>
  );
}
