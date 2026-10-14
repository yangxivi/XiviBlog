"use client";

import { useState } from "react";

type Msg = { type: "ok" | "err"; text: string } | null;

const MIN_LEN = 8;

function strength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= MIN_LEN) s++;
  if (pw.length >= 12) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: "太弱", color: "bg-red-500" },
    { label: "较弱", color: "bg-orange-500" },
    { label: "中等", color: "bg-yellow-500" },
    { label: "较强", color: "bg-emerald-500" },
    { label: "很强", color: "bg-emerald-600" },
  ];
  const m = map[Math.min(s, 4)];
  return { score: s, label: m.label, color: m.color };
}

function Field({
  label,
  value,
  onChange,
  type = "password",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--c-text-2)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-[var(--c-border-2)] bg-[var(--c-page)] px-3 py-2.5 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
      />
    </label>
  );
}

export default function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const s = strength(next);
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 &&
    next.length >= MIN_LEN &&
    /[A-Za-z]/.test(next) &&
    /\d/.test(next) &&
    next === confirm &&
    !mismatch;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: "ok", text: j.message || "密码修改成功" });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setMsg({ type: "err", text: j.error || "修改失败，请稍后重试" });
      }
    } catch {
      setMsg({ type: "err", text: "网络错误，请稍后重试" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--c-border-2)] bg-white p-6 dark:bg-slate-900">
      <div className="mb-6">
        <h2 className="text-base font-bold text-[var(--c-text)]">修改管理员密码</h2>
        <p className="mt-1 text-xs text-[var(--c-text-4)]">
          当前账号：<span className="font-medium text-[var(--c-text-2)]">{email}</span>
          <span className="mx-1.5 text-[var(--c-text-4)]">·</span>
          定期更换密码可提升后台安全性
        </p>
      </div>

      <form onSubmit={submit} className="max-w-md space-y-5">
        <Field
          label="当前密码"
          value={current}
          onChange={setCurrent}
          placeholder="请输入当前密码"
          autoComplete="current-password"
        />

        <div>
          <Field
            label="新密码"
            value={next}
            onChange={setNext}
            placeholder={`至少 ${MIN_LEN} 位，需包含字母和数字`}
            autoComplete="new-password"
          />
          {next && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-full flex-1 rounded-full transition-colors ${
                      i < s.score ? s.color : "bg-[var(--c-border-2)]"
                    }`}
                  />
                ))}
              </div>
              <span className="shrink-0 text-xs text-[var(--c-text-4)]">{s.label}</span>
            </div>
          )}
        </div>

        <Field
          label="确认新密码"
          value={confirm}
          onChange={setConfirm}
          placeholder="请再次输入新密码"
          autoComplete="new-password"
        />

        {mismatch && (
          <p className="text-xs text-red-500">两次输入的新密码不一致</p>
        )}

        {msg && (
          <p
            className={`rounded-lg border px-3 py-2 text-xs ${
              msg.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {msg.text}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-[var(--brand-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "提交中…" : "确认修改"}
          </button>
          <p className="text-xs text-[var(--c-text-4)]">
            修改成功后当前登录状态会自动续期
          </p>
        </div>
      </form>
    </div>
  );
}