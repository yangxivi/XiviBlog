"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Step = "verify" | "reset" | "done";

export default function ForgotForm() {
  const [step, setStep] = useState<Step>("verify");

  const [email, setEmail] = useState("");
  const [masterKey, setMasterKey] = useState("");
  const [token, setToken] = useState("");
  const [expiresIn, setExpiresIn] = useState(30);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const inputCls =
    "w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)]";

  /** 第一步：校验邮箱与找回密钥，换取一次性重置 token */
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, masterKey }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        expiresInMinutes?: number;
      };
      if (res.ok && j.token) {
        setToken(j.token);
        setExpiresIn(j.expiresInMinutes ?? 30);
        setStep("reset");
        return;
      }
      setErr(j.error || "验证失败");
    } catch {
      setErr("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  /** 第二步：用 token 设置新密码 */
  async function reset(e: React.FormEvent) {
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
        setStep("done");
        return;
      }
      setErr(j.error || "重置失败");
    } catch {
      setErr("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const resetUrl = origin && token ? `${origin}/admin/reset?token=${token}` : "";

  if (step === "done") {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--c-brand-soft)] text-2xl">
          ✓
        </div>
        <div>
          <p className="font-semibold text-[var(--c-text)]">密码已重置</p>
          <p className="mt-1 text-sm text-[var(--c-text-3)]">
            请使用新密码登录后台。
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

  if (step === "reset") {
    return (
      <form onSubmit={reset} className="space-y-4">
        <div className="rounded-lg border border-[var(--c-brand-border)] bg-[var(--c-brand-soft)] px-3.5 py-2.5 text-xs leading-5 text-[var(--brand-deep)]">
          身份验证通过。重置链接 {expiresIn} 分钟内有效
          {resetUrl && (
            <>
              ，也可复制链接稍后使用：
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(resetUrl)}
                className="ml-1 break-all text-left underline"
              >
                复制重置链接
              </button>
            </>
          )}
        </div>

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
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          注册邮箱
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
          找回密钥
        </label>
        <input
          type="password"
          value={masterKey}
          onChange={(e) => setMasterKey(e.target.value)}
          placeholder="站点管理员密码"
          required
          className={inputCls}
        />
        <p className="mt-1.5 text-xs leading-5 text-[var(--c-text-3)]">
          为安全起见，找回密码需要验证管理员密码。验证通过后即可设置新密码。
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
        {loading ? "验证中…" : "验证并继续"}
      </button>

      <p className="pt-1 text-center text-sm text-[var(--c-text-3)]">
        想起来了？{" "}
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
