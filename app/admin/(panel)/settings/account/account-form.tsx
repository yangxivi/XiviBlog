"use client";

import { useState } from "react";

type User = {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_login_at: string;
};

type Msg = { type: "ok" | "err"; text: string } | null;

const MIN_LEN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const inputCls =
  "w-full rounded-lg border border-[var(--c-border-2)] bg-[var(--c-page)] px-3 py-2.5 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
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
        className={inputCls}
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-[var(--c-text-4)]">{hint}</span>
      ) : null}
    </label>
  );
}

export default function AccountForm({ user }: { user: User }) {
  // 账号资料
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);

  // 修改密码
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const s = strength(next);
  const mismatch = confirm.length > 0 && next !== confirm;

  const profileDirty = name.trim() !== (user.name || "") || email.trim().toLowerCase() !== (user.email || "");
  const nameErr = name.trim() ? "" : "用户名不能为空";
  const emailErr = !email.trim()
    ? "邮箱不能为空"
    : EMAIL_RE.test(email.trim())
      ? ""
      : "邮箱格式不正确";
  const canSaveProfile =
    profileDirty && !nameErr && !emailErr && !profileBusy;

  const canChangePw =
    current.length > 0 &&
    next.length >= MIN_LEN &&
    /[A-Za-z]/.test(next) &&
    /\d/.test(next) &&
    next === confirm &&
    !mismatch &&
    !pwBusy;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveProfile) return;
    setProfileBusy(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "profile", name: name.trim(), email: email.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setProfileMsg({ type: "ok", text: j.message || "账号资料已更新" });
        setName(j.user?.name ?? name.trim());
        setEmail(j.user?.email ?? email.trim());
      } else {
        setProfileMsg({ type: "err", text: j.error || "保存失败，请稍后重试" });
      }
    } catch {
      setProfileMsg({ type: "err", text: "网络错误，请稍后重试" });
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!canChangePw) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "password",
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwMsg({ type: "ok", text: j.message || "密码修改成功" });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setPwMsg({ type: "err", text: j.error || "修改失败，请稍后重试" });
      }
    } catch {
      setPwMsg({ type: "err", text: "网络错误，请稍后重试" });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 账号资料 */}
      <div className="rounded-2xl border border-[var(--c-border-2)] bg-white p-6 dark:bg-slate-900">
        <div className="mb-6">
          <h2 className="text-base font-bold text-[var(--c-text)]">账号资料</h2>
          <p className="mt-1 text-xs text-[var(--c-text-4)]">
            修改管理员的用户名与登录邮箱。邮箱同时是后台登录账号，变更后请用新邮箱登录。
          </p>
        </div>

        <form onSubmit={saveProfile} className="max-w-md space-y-5">
          <Field
            label="用户名"
            value={name}
            onChange={setName}
            placeholder="请输入用户名"
            error={nameErr || undefined}
            hint={!nameErr ? "显示在后台昵称位置" : undefined}
          />

          <Field
            label="登录邮箱"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="you@example.com"
            autoComplete="username"
            error={emailErr || undefined}
            hint={!emailErr ? "用于登录后台，请确保可正常接收邮件" : undefined}
          />

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!canSaveProfile}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-[var(--brand-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {profileBusy ? "保存中…" : "保存资料"}
            </button>
            {profileDirty && !profileBusy && (
              <button
                type="button"
                onClick={() => {
                  setName(user.name || "");
                  setEmail(user.email || "");
                  setProfileMsg(null);
                }}
                className="text-xs text-[var(--c-text-4)] transition hover:text-[var(--c-text-2)]"
              >
                撤销修改
              </button>
            )}
          </div>

          {profileMsg && (
            <p
              className={`rounded-lg border px-3 py-2 text-xs ${
                profileMsg.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {profileMsg.text}
            </p>
          )}
        </form>
      </div>

      {/* 修改密码 */}
      <div className="rounded-2xl border border-[var(--c-border-2)] bg-white p-6 dark:bg-slate-900">
        <div className="mb-6">
          <h2 className="text-base font-bold text-[var(--c-text)]">修改密码</h2>
          <p className="mt-1 text-xs text-[var(--c-text-4)]">
            需验证当前密码。定期更换密码可提升后台安全性。
          </p>
        </div>

        <form onSubmit={changePassword} className="max-w-md space-y-5">
          <Field
            label="当前密码"
            value={current}
            onChange={setCurrent}
            type="password"
            placeholder="请输入当前密码"
            autoComplete="current-password"
          />

          <div>
            <Field
              label="新密码"
              value={next}
              onChange={setNext}
              type="password"
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
            type="password"
            placeholder="请再次输入新密码"
            autoComplete="new-password"
            error={mismatch ? "两次输入的新密码不一致" : undefined}
          />

          {pwMsg && (
            <p
              className={`rounded-lg border px-3 py-2 text-xs ${
                pwMsg.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {pwMsg.text}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canChangePw}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-[var(--brand-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pwBusy ? "提交中…" : "确认修改"}
            </button>
            <p className="text-xs text-[var(--c-text-4)]">
              修改成功后当前登录状态会自动续期
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}