"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (password.length < 6) return setErr("密码至少 6 位");
    if (password !== confirm) return setErr("两次输入的密码不一致");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, code }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        // 整页跳转，避免命中客户端路由缓存里未登录时的重定向结果
        window.location.assign("/admin");
        return;
      }
      setErr(j.error || "注册失败");
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
          昵称
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="显示在后台的名称"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          邮箱 <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          密码 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
          autoComplete="new-password"
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          确认密码 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再输一次"
          autoComplete="new-password"
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          注册邀请码 <span className="text-red-500">*</span>
        </label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="管理员密码（防止陌生人注册）"
          required
          className={inputCls}
        />
        <p className="mt-1.5 text-xs leading-5 text-[var(--c-text-3)]">
          邀请码即站点的管理员密码，改密码后邀请码同步变化。
        </p>
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
        {loading ? "创建中…" : "创建账号"}
      </button>

      <p className="pt-1 text-center text-sm text-[var(--c-text-3)]">
        已经有账号了？{" "}
        <Link
          href="/admin/login"
          className="font-medium text-[var(--brand-deep)] transition hover:underline"
        >
          去登录
        </Link>
      </p>
    </form>
  );
}
