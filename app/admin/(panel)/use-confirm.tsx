"use client";

import { useState } from "react";

type ConfirmOptions = {
  message: string;
  title?: string;
  /** 主按钮文案，默认「完成」 */
  okText?: string;
  cancelText?: string;
  danger?: boolean;
};

type InputOptions = ConfirmOptions & {
  defaultValue?: string;
  placeholder?: string;
};

type State = {
  kind: "confirm" | "input";
  opts: InputOptions;
  value: string;
  resolve: (v: string | null) => void;
};

/**
 * 后台统一的确认 / 输入弹窗。
 * 用自建弹窗替代浏览器原生 confirm/prompt（原生的按钮文案是「确定」且无法改样式）。
 */
export function useConfirm() {
  const [st, setSt] = useState<State | null>(null);

  function open(
    kind: "confirm" | "input",
    opts: InputOptions
  ): Promise<string | null> {
    return new Promise((resolve) =>
      setSt({ kind, opts, value: opts.defaultValue ?? "", resolve })
    );
  }

  const ask = (opts: ConfirmOptions) => open("confirm", opts);
  const askInput = (opts: InputOptions) => open("input", opts);

  function close(v: string | null) {
    st?.resolve(v);
    setSt(null);
  }

  const dialog = st ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-0"
      onClick={() => close(null)}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {st.opts.title && (
          <h3 className="text-base font-bold text-[var(--c-text)]">
            {st.opts.title}
          </h3>
        )}
        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--c-text-2)]">
          {st.opts.message}
        </p>

        {st.kind === "input" && (
          <input
            autoFocus
            value={st.value}
            placeholder={st.opts.placeholder}
            onChange={(e) => setSt({ ...st, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") close(st.value.trim() || null);
              if (e.key === "Escape") close(null);
            }}
            className="mt-4 w-full rounded-lg border border-[var(--c-border-3)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none focus:border-[var(--brand)]"
          />
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(null)}
            className="rounded-lg border border-[var(--c-border-3)] px-4 py-2 text-sm text-[var(--c-text-2)] transition hover:bg-[var(--c-fill)]"
          >
            {st.opts.cancelText || "取消"}
          </button>
          <button
            type="button"
            onClick={() => close(st.kind === "input" ? st.value.trim() || null : "ok")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              st.opts.danger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
            }`}
          >
            {st.opts.okText || "完成"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, askInput, dialog };
}
