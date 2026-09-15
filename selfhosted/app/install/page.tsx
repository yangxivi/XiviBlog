"use client";

import { useState } from "react";
import LogoMark, { BRAND_TEXT_CLASS } from "../components/LogoMark";

export default function InstallPage() {
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, confirm, siteName }),
      });
      const d = await r.json();
      if (!r.ok) {
        // 「博客已安装」的 409 视为成功（安装后 3 秒缓存窗口内重复提交时）
        if (String(d.error || "").includes("已安装")) {
          setDone(true);
        } else {
          setMsg(d.error || "安装失败");
        }
      } else {
        setDone(true);
      }
    } catch (err) {
      setMsg("网络错误：" + String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-neutral-50">
      {/* 顶部品牌头：LOGO + 品牌名，同一排整体居中 */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-center gap-2.5 px-4 md:px-6">
          <LogoMark text="曦微" />
          <span className={`${BRAND_TEXT_CLASS} text-neutral-900`}>
            曦微博客系统 XiviBlogSystem
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        <h1 className="text-2xl font-bold text-neutral-900 text-center">
          XiviBlog 安装向导
        </h1>

        {!done ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="站点名称（可选）">
              <input
                className="input"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="曦微博客"
              />
            </Field>
            <Field label="管理员邮箱">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field label="管理员密码（≥6 位）">
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="确认密码">
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>

            {msg && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-neutral-900 text-white py-2.5 font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy ? "安装中…" : "完成安装"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-center text-sm text-neutral-700">
            🎉 安装成功！前往{" "}
            <a className="underline font-medium" href="/admin/login">
              后台登录
            </a>
            ，或{" "}
            <a className="underline font-medium" href="/">
              返回首页
            </a>
            。
          </p>
        )}

        <style>{`
          .input{width:100%;border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}
          .input:focus{border-color:#111}
        `}</style>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
