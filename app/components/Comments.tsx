"use client";

/**
 * 免注册留言/评论区：关于页（pageKey="about"）与文章页（pageKey="post:<id>"）共用。
 * 游客身份（昵称 + emoji 头像）首次留言时由系统生成，localStorage 持久化，
 * 之后换页面留言身份不变。接口同样做了服务端限频与长度校验。
 */
import { useEffect, useRef, useState } from "react";

type CommentItem = {
  id: number;
  nickname: string;
  avatar: string;
  content: string;
  created_at: string;
};

type Identity = { nickname: string; avatar: string };

const LS_KEY = "xivi_comment_identity";
const MAX_LEN = 500;

/** 由昵称稳定算出色相，同一个人头像底色永远一样 */
function hueOf(nickname: string): number {
  let s = 0;
  for (let i = 0; i < nickname.length; i++) s = (s * 31 + nickname.charCodeAt(i)) % 360;
  return s;
}

function timeAgo(cn: string): string {
  const t = new Date(cn.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return cn.slice(0, 10);
  const diff = Math.max(0, Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return cn.slice(0, 10);
}

function Avatar({ nickname, avatar }: { nickname: string; avatar: string }) {
  const h = hueOf(nickname);
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full text-lg"
      style={{ background: `hsl(${h} 70% 88%)` }}
      title={nickname}
    >
      {avatar || "🙂"}
    </span>
  );
}

export default function Comments({
  pageKey,
  placeholder = "说点什么吧…（免注册，系统自动生成昵称头像）",
}: {
  pageKey: string;
  placeholder?: string;
}) {
  const [list, setList] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const idRef = useRef<Identity | null>(null);

  useEffect(() => {
    idRef.current = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    setIdentity(idRef.current);
    fetch(`/api/comments?page=${encodeURIComponent(pageKey)}`)
      .then((r) => r.json() as Promise<{ comments?: CommentItem[] }>)
      .then((j) => setList(j.comments || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [pageKey]);

  async function submit() {
    const content = text.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageKey, content, ...idRef.current }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        comment?: CommentItem;
        generated?: boolean;
      };
      if (!r.ok || !j.ok || !j.comment) {
        setMsg({ ok: false, text: j.error || `提交失败（HTTP ${r.status}）` });
        return;
      }
      if (j.generated || !idRef.current) {
        // 服务端生成了新身份（或本地缺失）→ 记住它
        idRef.current = { nickname: j.comment.nickname, avatar: j.comment.avatar };
        localStorage.setItem(LS_KEY, JSON.stringify(idRef.current));
        setIdentity(idRef.current);
      }
      setList((l) => [...l, j.comment!]);
      setText("");
      setMsg({ ok: true, text: "已发布" });
    } catch {
      setMsg({ ok: false, text: "网络异常，稍后再试" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="comments"
      className="mt-10 rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-5 sm:p-7"
    >
      <h2 className="text-base font-bold text-[var(--c-text)]">
        留言评论
        <span className="ml-2 text-xs font-normal text-[var(--c-text-4)]">
          {list.length > 0 ? `${list.length} 条` : "还没有留言，来抢沙发"}
        </span>
      </h2>

      {/* 输入区 */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--c-text-3)]">
          {identity ? (
            <>
              <Avatar nickname={identity.nickname} avatar={identity.avatar} />
              <span>
                我的身份：<b className="text-[var(--c-text-2)]">{identity.nickname}</b>
                （自动生成，已记住）
              </span>
            </>
          ) : (
            <span>📝 免注册留言：提交后系统自动生成昵称和头像</span>
          )}
        </div>
        <textarea
          value={text}
          maxLength={MAX_LEN}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-y rounded-xl border border-[var(--c-border-2)] bg-[var(--c-page)] px-3.5 py-2.5 text-sm text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-text-4)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--c-brand-border)]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--c-text-4)]">
            {msg ? (
              <span className={msg.ok ? "text-emerald-600" : "text-red-500"}>{msg.text}</span>
            ) : (
              `发言请友善，最多 ${MAX_LEN} 字`
            )}
          </span>
          <button
            type="button"
            disabled={submitting || !text.trim()}
            onClick={submit}
            className="rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-bold text-[var(--brand-ink)] transition hover:brightness-105 disabled:opacity-40"
          >
            {submitting ? "发布中…" : "发布留言"}
          </button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <p className="mt-6 text-sm text-[var(--c-text-4)]">加载中…</p>
      ) : list.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--c-text-4)]">
          暂无留言，第一条评论由你来写 ✍️
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar nickname={c.nickname} avatar={c.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-[var(--c-text)]">
                    {c.nickname}
                  </span>
                  <time
                    dateTime={c.created_at}
                    title={c.created_at}
                    className="text-xs text-[var(--c-text-4)]"
                  >
                    {timeAgo(c.created_at)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--c-text-2)]">
                  {c.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
