"use client";

import { useEffect, useState } from "react";

export default function InstallPage() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/install")
      .then((r) => r.json())
      .then((d) => setInstalled(!!d.installed))
      .catch(() => setInstalled(false));
  }, []);

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
        setMsg(d.error || "安装失败");
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
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        <h1 className="text-2xl font-bold text-neutral-900">XiviBlog 安装向导</h1>
        <p className="mt-1 text-sm text-neutral-500">
          只需一步即可完成部署：创建管理员账号 + 初始化数据库。
        </p>

        {installed === null && (
          <p className="mt-6 text-sm text-neutral-400">正在检查安装状态…</p>
        )}

        {installed === true && (
          <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            博客已安装。请前往 <a className="underline font-medium" href="/admin">/admin</a> 登录后台。
          </div>
        )}

        {installed === false && !done && (
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
        )}

        {done && (
          <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 space-y-2">
            <p className="font-medium">🎉 安装成功！</p>
            <p>
              数据库已初始化，管理员账号已创建。现在前往{" "}
              <a className="underline font-medium" href="/admin">/admin</a> 登录即可开始写文章。
            </p>
          </div>
        )}

        <style>{`
          .input{width:100%;border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}
          .input:focus{border-color:#111}
        `}</style>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
