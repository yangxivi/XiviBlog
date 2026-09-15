import Link from "next/link";
import type { ReactNode } from "react";

/** 后台认证页面统一外壳（登录 / 注册 / 找回密码 / 重置密码） */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-14">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand)] text-base font-black text-[var(--brand-ink)] transition hover:brightness-95"
            title="返回首页"
          >
            XV
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--c-text)]">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-[var(--c-text-3)]">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-7 shadow-sm">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--c-text-4)]">
          © {new Date().getFullYear()} 曦微博客系统 XiviBlogSystem · 后台管理
        </p>
      </div>
    </div>
  );
}

/** 表单字段：标签 + 输入框，样式统一 */
export function Field({
  label,
  hint,
  ...props
}: {
  label: string;
  hint?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--c-text-2)]">
        {label}
      </span>
      <input
        {...props}
        className={
          "w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)] " +
          (props.className ?? "")
        }
      />
      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-[var(--c-text-3)]">
          {hint}
        </span>
      )}
    </label>
  );
}

/** 主按钮 */
export function SubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** 错误 / 成功提示条 */
export function Notice({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  const cls =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-[var(--c-brand-border)] bg-[var(--c-brand-soft)] text-[var(--brand-deep)]";
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>
  );
}
