"use client";

import { useEffect, useRef, useState } from "react";
import type { FriendLink } from "@/lib/settings";
import { normalizeFriendUrl, prettyHost } from "@/lib/friend-url";

export type FriendCheck = {
  href: string;
  ok: number;
  status: number;
  ms: number;
  error: string;
  final_url: string;
  failures: number;
  checked_at: string;
};

export type FriendSummary = {
  total: number;
  ok: number;
  bad: number;
  unknown: number;
  lastAt: string;
  badNames: string[];
};

const BTN =
  "rounded-lg border border-[var(--c-border-3)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)] disabled:opacity-40";

/** UTC 串 → 东八区 MM-DD HH:mm */
function cnTime(utc: string): string {
  if (!utc) return "";
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return utc;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

function statusText(c: FriendCheck): { text: string; tone: "ok" | "bad" | "warn" } {
  if (c.ok) return { text: `${c.status} · ${c.ms}ms`, tone: "ok" };
  if (c.status === 0) return { text: c.error || "请求失败", tone: "bad" };
  return { text: `HTTP ${c.status}`, tone: "bad" };
}

const TONE: Record<string, string> = {
  ok: "text-[#047857]",
  bad: "text-red-500",
  warn: "text-[#FF6B35]",
};

const DOT: Record<string, string> = {
  ok: "bg-[#10b981]",
  bad: "bg-red-500",
  warn: "bg-[#FF6B35]",
  none: "bg-[var(--c-border-3)]",
};

/**
 * 友链存活检测面板。
 *
 * 打开设置页时：先读已有结果 → 发现有「没测过」或「超过 24 小时」的，自动补测一次。
 * 平时由站点访问触发的心跳任务每天自动检测一遍（见 lib/maintenance.ts）。
 * 手工「检测全部」用的是**表单当前值**，所以没保存的新友链也能先测再存。
 */
export default function FriendCheckPanel({
  current,
}: {
  /** 表单当前值：手工「检测全部」测的就是这些（未保存的新友链也能先测） */
  current: FriendLink[];
}) {
  const [checks, setChecks] = useState<Record<string, FriendCheck>>({});
  const [summary, setSummary] = useState<FriendSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const autoRan = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/friends");
        const j = (await res.json().catch(() => null)) as {
          ok?: boolean;
          checks?: Record<string, FriendCheck>;
          summary?: FriendSummary;
          stale?: string[];
        } | null;
        if (!alive || !j?.ok) return;
        setChecks(j.checks ?? {});
        setSummary(j.summary ?? null);

        const stale = j.stale ?? [];
        if (stale.length && !autoRan.current) {
          autoRan.current = true;
          setBusy(true);
          const r2 = await fetch("/api/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hrefs: stale }),
          });
          const j2 = (await r2.json().catch(() => null)) as {
            ok?: boolean;
            checked?: number;
            checks?: Record<string, FriendCheck>;
            summary?: FriendSummary;
          } | null;
          if (!alive) return;
          if (j2?.ok) {
            setChecks(j2.checks ?? {});
            setSummary(j2.summary ?? null);
            setNote(`已自动补测 ${j2.checked ?? 0} 条过期友链`);
          }
        }
      } catch {
        /* 静默：检测不可用不影响改设置 */
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function checkAll() {
    const hrefs = [
      ...new Set(
        current.map((f) => normalizeFriendUrl(f.href)).filter(Boolean)
      ),
    ];
    if (!hrefs.length) {
      setNote("还没有可检测的友链地址");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hrefs }),
      });
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        checked?: number;
        checks?: Record<string, FriendCheck>;
        summary?: FriendSummary;
        error?: string;
      } | null;
      if (!j?.ok) throw new Error(j?.error || "检测失败");
      setChecks(j.checks ?? {});
      setSummary(j.summary ?? null);
      setNote(`已检测 ${j.checked ?? 0} 条`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /* 按表单当前值渲染，保证「刚加的那条」也出现在结果里 */
  const rows = current
    .map((f) => {
      const href = normalizeFriendUrl(f.href);
      return { name: f.name, href, check: href ? checks[href] : undefined };
    })
    .filter((r) => r.href || r.name.trim());

  return (
    <div className="mt-4 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-[var(--c-text)]">
            存活检测
          </h3>
          <p className="mt-1 text-xs text-[var(--c-text-4)]">
            {busy
              ? "检测中…"
              : summary
                ? `共 ${summary.total} 条 · 正常 ${summary.ok} · 异常 ${summary.bad}${
                    summary.unknown ? ` · 未检测 ${summary.unknown}` : ""
                  }${summary.lastAt ? ` · 最近检测 ${cnTime(summary.lastAt)}` : ""}`
                : "打开本页会自动补测过期友链，平时每天随站点访问自动检测一次"}
            {note && <span className="ml-2 text-[var(--brand-deep)]">{note}</span>}
          </p>
        </div>
        <button type="button" className={BTN} onClick={checkAll} disabled={busy}>
          {busy ? "检测中…" : "立即检测全部"}
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => {
            const c = r.check;
            const st = c ? statusText(c) : null;
            const tone = st?.tone ?? "none";
            return (
              <li
                key={`${r.href}-${i}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`}
                  aria-hidden
                />
                <span className="min-w-0 max-w-[46%] truncate text-[var(--c-text)]">
                  {r.name.trim() || prettyHost(r.href)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--c-text-4)]">
                  {r.href ? prettyHost(r.href) : "地址为空 / 格式不对"}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${st ? TONE[tone] : "text-[var(--c-text-4)]"}`}
                >
                  {st ? st.text : "未检测"}
                </span>
                {c && !c.ok && c.failures > 1 && (
                  <span className="shrink-0 text-[#FF6B35]">
                    连续失败 {c.failures} 次
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {summary && summary.bad > 0 && (
        <p className="mt-3 rounded-lg border border-[#FFE0D0] bg-[#FFF7F2] px-3 py-2 text-xs text-[#FF6B35]">
          以下友链当前不可访问，建议联系对方或先下掉：
          {summary.badNames.join("、")}
        </p>
      )}
    </div>
  );
}
