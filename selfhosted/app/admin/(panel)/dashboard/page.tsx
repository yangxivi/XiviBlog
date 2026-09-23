import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import {
  getStatsOverview,
  listDaily,
  listLatest,
  countPublished,
  type DailyPoint,
  type PostMeta,
} from "@/lib/db";
import { countComments, listRecentComments } from "@/lib/comments";
import CommentAvatar from "./comment-avatar";
import { cnTime, cnDay } from "@/lib/datetime";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "仪表盘" };

const CARD = "rounded-2xl border border-[var(--c-border-2)] p-5 bg-white dark:bg-slate-900";
const H2 = "text-sm font-bold text-[var(--c-text)]";

function Kpi({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: string;
  href?: string;
}) {
  const wrap = (child: React.ReactNode) =>
    href ? (
      <Link href={href} className="block h-full transition hover:opacity-80">
        {child}
      </Link>
    ) : (
      <div className="block h-full">{child}</div>
    );
  return wrap(
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--c-text-3)]">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--c-text)]">
        {value.toLocaleString("zh-CN")}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--c-text-4)]">{sub}</p>}
    </div>
  );
}

/** 纯 SVG 趋势图：柱=PV，折线=UV */
function Trend({ data }: { data: DailyPoint[] }) {
  const W = 900;
  const H = 200;
  const PAD_L = 10;
  const PAD_B = 26;
  const n = data.length || 1;
  const step = (W - PAD_L * 2) / n;
  const barW = Math.max(3, step * 0.55);
  const max = Math.max(1, ...data.map((d) => d.pv));
  const plotH = H - PAD_B - 10;

  const xOf = (i: number) => PAD_L + i * step + (step - barW) / 2;
  const yOf = (v: number) => 10 + plotH - (v / max) * plotH;

  const uvPoints = data
    .map((d, i) => `${(xOf(i) + barW / 2).toFixed(1)},${yOf(d.uv).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[200px] w-full"
      role="img"
      aria-label="近 30 天访问趋势"
    >
      <line
        x1={PAD_L}
        y1={10 + plotH}
        x2={W - PAD_L}
        y2={10 + plotH}
        stroke="var(--c-border-2)"
        strokeWidth="1"
      />
      {data.map((d, i) => {
        const h = (d.pv / max) * plotH;
        return (
          <rect
            key={d.day}
            x={xOf(i)}
            y={10 + plotH - h}
            width={barW}
            height={Math.max(d.pv > 0 ? 1.5 : 0, h)}
            rx="1.5"
            fill="var(--brand)"
          >
            <title>{`${d.day}  PV ${d.pv} / UV ${d.uv}`}</title>
          </rect>
        );
      })}
      {data.some((d) => d.uv > 0) && (
        <polyline
          points={uvPoints}
          fill="none"
          stroke="#111925"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {data.map((d, i) =>
        i % 5 === 0 || i === n - 1 ? (
          <text
            key={`t${d.day}`}
            x={xOf(i) + barW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--c-text-4)"
          >
            {d.day.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/** 把 /blog/xxx 换成文章标题，其它路径原样展示 */
function labelPath(path: string, titles: Map<string, string>) {
  if (path.startsWith("/blog/")) {
    const slug = path.slice("/blog/".length);
    return titles.get(slug) ?? `${path}（已删除）`;
  }
  const fixed: Record<string, string> = {
    "/": "首页",
    "/history": "历史文章",
    "/about": "关于我们",
    "/search": "搜索页",
  };
  return fixed[path] ?? path;
}

export default async function DashboardPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();
  const h = await headers();
  const siteUrl = `${h.get("x-forwarded-proto") || "https"}://${
    h.get("host") || "blog.aixivi.cn"
  }`;

  let overview = { pv: 0, uv: 0, todayPv: 0, todayUv: 0, weekPv: 0, weekUv: 0, monthPv: 0, monthUv: 0 };
  let daily: DailyPoint[] = [];
  let postCount = 0;
  let commentCount = 0;
  let latestPosts: PostMeta[] = [];
  let recentComments: Awaited<ReturnType<typeof listRecentComments>> = [];
  let dbError = "";

  try {
    [overview, daily, postCount, commentCount, latestPosts, recentComments] =
      await Promise.all([
        getStatsOverview(),
        listDaily(30),
        countPublished(),
        countComments(),
        listLatest(5),
        listRecentComments(5),
      ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const titles = new Map(latestPosts.map((p) => [p.slug, p.title]));

  // 本月发布数
  const thisMonth = cnDay(0).slice(0, 7); // YYYY-MM
  const monthPosts = latestPosts.filter((p) => p.created_at.startsWith(thisMonth)).length;

  return (
    <>
      {dbError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI 卡片行 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 h-full">
            <Kpi
              label="总文章数"
              value={postCount}
              icon="📝"
              href="/admin/posts"
            />
            <Kpi
              label="总留言数"
              value={commentCount}
              icon="💬"
              href="/admin/comments"
            />
            <Kpi
              label="累计浏览 PV"
              value={overview.pv}
              sub={`累计访客 ${overview.uv.toLocaleString("zh-CN")}`}
              icon="👀"
              href="/admin/stats"
            />
            <Kpi
              label="本月发布"
              value={monthPosts}
              icon="📅"
              href="/admin/posts"
            />
          </div>

          {/* 趋势图 + 快捷操作 */}
          <div className="grid gap-6 lg:grid-cols-3 h-full">
            <section className="lg:col-span-2 h-full">
              <div className={CARD}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={H2}>近 30 天浏览趋势</h2>
                  <div className="flex items-center gap-4 text-xs text-[var(--c-text-3)]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--brand)]" />
                      浏览 PV
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-[2px] w-4 bg-[#111925]" />
                      访客 UV
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <Trend data={daily} />
                </div>
              </div>
            </section>

            <section>
              <div className={CARD}>
                <h2 className={H2}>快捷操作</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { href: "/admin/posts?new=1", label: "新文章", icon: "✏️" },
                    { href: "/admin/comments", label: "留言审核", icon: "💬" },
                    { href: "/admin/settings", label: "基础设置", icon: "⚙️" },
                    { href: "/admin/settings/ai", label: "AI 工具", icon: "🤖" },
                    { href: siteUrl, label: "前台首页", icon: "🏠", external: true },
                    { href: "/admin/stats", label: "访问统计", icon: "📊" },
                  ].map((item) => (
                    item.external ? (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-page)] p-3 text-center transition hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
                      >
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-xs font-medium text-[var(--c-text)]">{item.label}</span>
                      </a>
                    ) : (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--c-border-2)] bg-[var(--c-page)] p-3 text-center transition hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
                      >
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-xs font-medium text-[var(--c-text)]">{item.label}</span>
                      </Link>
                    )
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* 最近文章 + 最近留言 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={CARD}>
              <div className="flex items-center justify-between">
                <h2 className={H2}>最近文章</h2>
                <Link
                  href="/admin/posts"
                  className="text-xs text-[var(--brand-deep)] hover:underline"
                >
                  查看全部 →
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {latestPosts.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/posts/${p.id}/edit`}
                      className="min-w-0 flex-1 truncate text-sm text-[var(--c-text)] transition-colors hover:text-[var(--brand-deep)]"
                    >
                      {p.title}
                    </Link>
                    <span className="shrink-0 text-xs text-[var(--c-text-4)]">
                      {cnTime(p.created_at)}
                    </span>
                  </li>
                ))}
                {latestPosts.length === 0 && (
                  <li className="py-6 text-center text-xs text-[var(--c-text-4)]">
                    还没有文章。去写第一篇吧！
                  </li>
                )}
              </ul>
            </section>

            <section className={CARD}>
              <div className="flex items-center justify-between">
                <h2 className={H2}>最近留言</h2>
                <Link
                  href="/admin/comments"
                  className="text-xs text-[var(--brand-deep)] hover:underline"
                >
                  查看全部 →
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {recentComments.map((c) => (
                  <li key={c.id} className="border-b border-[var(--c-border-2)] last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-2">
                      <CommentAvatar avatar={c.avatar} nickname={c.nickname} />
                      <span className="text-sm font-medium text-[var(--c-text)]">
                        {c.nickname}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--c-text-4)]">
                        {cnTime(c.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--c-text-3)]">
                      {c.content}
                    </p>
                  </li>
                ))}
                {recentComments.length === 0 && (
                  <li className="py-6 text-center text-xs text-[var(--c-text-4)]">
                    还没有留言。让读者开始互动吧！
                  </li>
                )}
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
