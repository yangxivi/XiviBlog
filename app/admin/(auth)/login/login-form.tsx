"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        // 必须整页跳转：router.push 会命中客户端路由缓存里「未登录时 /admin → /admin/login」
        // 的旧结果，导致登录成功后仍停在登录页（看起来像登录失败）。
        const target = next && next.startsWith("/") ? next : "/admin";
        window.location.assign(target);
        return;
      }
      setErr(j.error || "登录失败");
    } catch {
      setErr("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          邮箱
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          autoFocus
          className="w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          密码
        </label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 pr-14 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)]"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-[var(--c-text-3)] transition hover:text-[var(--brand-deep)]"
          >
            {show ? "隐藏" : "显示"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-[var(--c-text-2)]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          记住我（30 天）
        </label>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "登录中…" : "登 录"}
      </button>

      <p className="pt-1 text-center text-sm text-[var(--c-text-3)]">
        曦微博客 · 单管理员系统
      </p>
    </form>
  );
}
