import { getDB } from "./db";
import { getSettings, type FriendLink } from "./settings";
import { isPrivateHost, normalizeFriendUrl } from "./friend-url";

/* ==========================================================================
 * 友链存活检测（服务端发起）
 *
 * 只在 Cloudflare 边缘发请求，前端不掺和（浏览器直连第三方会被 CORS 拦）。
 * wrangler.jsonc 里开着 global_fetch_strictly_public，指向内网/本机的地址
 * 会被运行时直接拒掉 —— 这是防 SSRF 的真正兜底，本文件里的私网判断只是
 * 为了让错误信息更友好。
 * ========================================================================== */

/** 超过这个时长就认为「该重新检测了」 */
export const FRIEND_CHECK_MAX_AGE_HOURS = 24;
const TIMEOUT_MS = 8000;
const PROBE_UA =
  "Mozilla/5.0 (compatible; XIVIBlogLinkCheck/1.0; +https://blog.aixivi.cn)";

export type ProbeResult = {
  ok: number; // 1 正常 / 0 异常
  status: number; // HTTP 状态码，0 = 请求没走通
  ms: number;
  error: string;
  final_url: string;
};

export type FriendCheck = ProbeResult & {
  href: string;
  failures: number; // 连续失败次数
  checked_at: string;
};

type Attempt =
  | { kind: "done"; res: ProbeResult }
  | { kind: "retry"; reason: string };

async function attempt(
  url: string,
  method: "HEAD" | "GET",
  started: number
): Promise<Attempt> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": PROBE_UA,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    const ms = Date.now() - started;

    // HEAD 常被 WAF / CDN 拦（403 / 405 / 501），不代表站点真的挂了 → 用 GET 复验
    if (
      method === "HEAD" &&
      (res.status === 403 || res.status === 405 || res.status === 501)
    ) {
      try {
        await res.body?.cancel();
      } catch {
        /* 忽略 */
      }
      return { kind: "retry", reason: `HEAD ${res.status}` };
    }

    const ok = res.status >= 200 && res.status < 400;
    // 只要状态码，正文不看：立刻取消，既省流量也不把对方页面拖下来
    try {
      await res.body?.cancel();
    } catch {
      /* 忽略 */
    }
    return {
      kind: "done",
      res: {
        ok: ok ? 1 : 0,
        status: res.status,
        ms,
        error: ok ? "" : `HTTP ${res.status}`,
        final_url: res.url || url,
      },
    };
  } catch (e) {
    const ms = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);

    // HEAD 失败一律换 GET 再试：很多站点干脆不支持 HEAD
    if (method === "HEAD") return { kind: "retry", reason: msg };

    const isTimeout =
      (e instanceof Error && e.name === "AbortError") || /abort/i.test(msg);
    return {
      kind: "done",
      res: {
        ok: 0,
        status: 0,
        ms,
        error: isTimeout ? `超时（>${TIMEOUT_MS / 1000} 秒）` : msg.slice(0, 160),
        final_url: "",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 探测单个地址：先 HEAD 再 GET 兜底，跟随跳转，8 秒超时 */
export async function probe(rawUrl: string): Promise<ProbeResult> {
  const target = normalizeFriendUrl(rawUrl);
  if (!target) {
    return {
      ok: 0,
      status: 0,
      ms: 0,
      error: "地址不合法（需以 http/https 开头）",
      final_url: "",
    };
  }
  if (isPrivateHost(target)) {
    return {
      ok: 0,
      status: 0,
      ms: 0,
      error: "本机/内网地址，服务端不检测",
      final_url: "",
    };
  }

  const started = Date.now();
  const head = await attempt(target, "HEAD", started);
  if (head.kind === "done") return head.res;

  const get = await attempt(target, "GET", started);
  if (get.kind === "done") return get.res;

  return {
    ok: 0,
    status: 0,
    ms: Date.now() - started,
    error: get.reason.slice(0, 160),
    final_url: "",
  };
}

/** 批量检测并落库。并发 4：够快，又不至于被对方当成攻击 */
export async function runChecks(
  rawHrefs: string[],
  opts: { concurrency?: number; prune?: boolean } = {}
): Promise<FriendCheck[]> {
  const db = await getDB();
  const hrefs = [...new Set(rawHrefs.map(normalizeFriendUrl).filter(Boolean))];
  const concurrency = Math.min(6, Math.max(1, opts.concurrency ?? 4));
  const out: FriendCheck[] = [];

  for (let i = 0; i < hrefs.length; i += concurrency) {
    const slice = hrefs.slice(i, i + concurrency);
    const batch = await Promise.all(
      slice.map(async (href): Promise<FriendCheck> => {
        const r = await probe(href);
        const prev = await db
          .prepare("SELECT failures FROM friend_checks WHERE href=?1")
          .bind(href)
          .first<{ failures: number }>();
        const failures = r.ok ? 0 : (prev?.failures ?? 0) + 1;

        await db
          .prepare(
            `INSERT INTO friend_checks (href, ok, status, ms, error, final_url, failures, checked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
             ON CONFLICT(href) DO UPDATE SET
               ok=?2, status=?3, ms=?4, error=?5, final_url=?6, failures=?7,
               checked_at=datetime('now')`
          )
          .bind(href, r.ok, r.status, r.ms, r.error, r.final_url, failures)
          .run();

        return { href, failures, checked_at: "", ...r };
      })
    );
    out.push(...batch);
  }

  // ⚠️ 注意：prune 只在「targets 等于完整友链集合」时才是安全的。
  // 部分重测（stale 子集 / 面板补测 / 面板「检测全部」带未保存值）绝不能 prune，
  // 否则会把没在本次列表里的正常友链检测记录一并删掉，导致面板误报「未检测」。
  // 孤儿行（已从设置里删掉的友链）由每周清理任务 pruneOrphanChecks() 回收。
  if (opts.prune && hrefs.length) {
    await pruneChecks(hrefs);
  }
  return out;
}

/** 删掉「不在 keepHrefs 集合里」的检测记录（仅当 keepHrefs 是完整友链集合时才调用） */
export async function pruneChecks(keepHrefs: string[]): Promise<number> {
  if (!keepHrefs.length) return 0;
  const db = await getDB();
  const holes = keepHrefs.map(() => "?").join(",");
  const r = await db
    .prepare(`DELETE FROM friend_checks WHERE href NOT IN (${holes})`)
    .bind(...keepHrefs)
    .run();
  return r.meta.changes ?? 0;
}

/** 删掉「已不在友链列表里的」孤儿检测记录。由每周清理任务调用，绝不在部分重测时调用 */
export async function pruneOrphanChecks(): Promise<number> {
  const settings = await getSettings();
  const keep = [
    ...new Set(settings.friends.map((f) => normalizeFriendUrl(f.href)).filter(Boolean)),
  ];
  const db = await getDB();
  if (!keep.length) {
    const r = await db.prepare("DELETE FROM friend_checks").run();
    return r.meta.changes ?? 0;
  }
  const holes = keep.map(() => "?").join(",");
  const r = await db
    .prepare(`DELETE FROM friend_checks WHERE href NOT IN (${holes})`)
    .bind(...keep)
    .run();
  return r.meta.changes ?? 0;
}

/** 全部检测结果，key 为规范化后的地址 */
export async function listChecks(): Promise<Record<string, FriendCheck>> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT href, ok, status, ms, error, final_url, failures, checked_at FROM friend_checks"
    )
    .all<FriendCheck>();
  const out: Record<string, FriendCheck> = {};
  for (const r of results ?? []) out[r.href] = r;
  return out;
}

/** 后台友链里「没检测过」或「检测结果过期」的地址 */
export async function staleHrefs(
  maxAgeHours = FRIEND_CHECK_MAX_AGE_HOURS
): Promise<string[]> {
  const settings = await getSettings();
  const hrefs = [
    ...new Set(settings.friends.map((f) => normalizeFriendUrl(f.href)).filter(Boolean)),
  ];
  if (!hrefs.length) return [];

  const db = await getDB();
  const { results } = await db
    .prepare("SELECT href, checked_at FROM friend_checks")
    .all<{ href: string; checked_at: string }>();
  const seen = new Map((results ?? []).map((r) => [r.href, r.checked_at]));

  const out: string[] = [];
  for (const h of hrefs) {
    const t = seen.get(h);
    if (!t) {
      out.push(h);
      continue;
    }
    const ms = Date.parse(t.replace(" ", "T") + "Z");
    if (Number.isNaN(ms) || Date.now() - ms >= maxAgeHours * 3600_000) {
      out.push(h);
    }
  }
  return out;
}

/** 定时任务体：只检测过期的那些 */
export async function checkFriendsJob(
  maxAgeHours = FRIEND_CHECK_MAX_AGE_HOURS
): Promise<{ checked: number; bad: number }> {
  const hrefs = await staleHrefs(maxAgeHours);
  if (!hrefs.length) return { checked: 0, bad: 0 };
  // 只测过期的子集，绝不能 prune —— 否则会删掉正常友链的检测记录
  const results = await runChecks(hrefs, { prune: false });
  return { checked: results.length, bad: results.filter((r) => !r.ok).length };
}

export type FriendSummary = {
  total: number;
  ok: number;
  bad: number;
  unknown: number;
  lastAt: string;
  badNames: string[];
};

/** 按当前友链列表给出汇总（没检测过的算 unknown） */
export function summarizeFriends(
  friends: FriendLink[],
  checks: Record<string, FriendCheck>
): FriendSummary {
  const s: FriendSummary = {
    total: 0,
    ok: 0,
    bad: 0,
    unknown: 0,
    lastAt: "",
    badNames: [],
  };
  const seen = new Set<string>();
  for (const f of friends) {
    const href = normalizeFriendUrl(f.href);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    s.total++;
    const c = checks[href];
    if (!c) {
      s.unknown++;
      continue;
    }
    if (c.checked_at > s.lastAt) s.lastAt = c.checked_at;
    if (c.ok) s.ok++;
    else {
      s.bad++;
      s.badNames.push(f.name || href);
    }
  }
  return s;
}
