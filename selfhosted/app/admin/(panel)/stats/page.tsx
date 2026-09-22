import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import {
  getFeedOverview,
  listFeedDaily,
  listRecentFeedHits,
  listTopReaders,
  type FeedDay,
  type FeedOverview,
  type ReaderStat,
  type RecentFeedHit,
} from "@/lib/feed";
import {
  cnTime,
  getSearchOverview,
  getStatsOverview,
  listAll,
  listDaily,
  listRecentHits,
  listRecentSearches,
  listTopPaths,
  listTopReferrers,
  listTopSearches,
  listZeroResultSearches,
  type DailyPoint,
  type PathStat,
  type PostMeta,
  type RecentHit,
  type RecentSearch,
  type ReferrerStat,
  type SearchOverview,
  type SearchStat,
  type StatsOverview,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "访问统计" };

const CARD = "rounded-2xl border border-[var(--c-border-2)] p-5";
const H2 = "text-sm font-bold text-[var(--c-text)]";

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className={CARD}>
      <p className="text-xs text-[var(--c-text-3)]">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--c-text)]">
        {value.toLocaleString("zh-CN")}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--c-text-4)]">{sub}</p>}
    </div>
  );
}

/** 纯 SVG 趋势图：柱=PV，折线=UV，不引第三方图表库 */
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
      {/* 基线 */}
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

/** RSS 抓取趋势：柱=抓取次数，折线=独立读者 */
function FeedTrend({ data }: { data: FeedDay[] }) {
  const W = 900;
  const H = 150;
  const PAD_L = 10;
  const PAD_B = 24;
  const PAD_T = 10;
  const n = data.length || 1;
  const step = (W - PAD_L * 2) / n;
  const barW = Math.max(3, step * 0.5);
  const max = Math.max(1, ...data.map((d) => d.hits));
  const plotH = H - PAD_B - PAD_T;

  const xOf = (i: number) => PAD_L + i * step + (step - barW) / 2;
  const yOf = (v: number) => PAD_T + plotH - (v / max) * plotH;

  const visitorPoints = data
    .map((d, i) => `${(xOf(i) + barW / 2).toFixed(1)},${yOf(d.visitors).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[150px] w-full"
      role="img"
      aria-label="近 30 天 RSS 抓取趋势"
    >
      <line
        x1={PAD_L}
        y1={PAD_T + plotH}
        x2={W - PAD_L}
        y2={PAD_T + plotH}
        stroke="var(--c-border-2)"
        strokeWidth="1"
      />
      {data.map((d, i) => {
        const h = (d.hits / max) * plotH;
        return (
          <rect
            key={d.day}
            x={xOf(i)}
            y={PAD_T + plotH - h}
            width={barW}
            height={Math.max(d.hits > 0 ? 1.5 : 0, h)}
            rx="1.5"
            fill="var(--brand)"
          >
            <title>{`${d.day}  抓取 ${d.hits} 次 / 读者 ${d.visitors}`}</title>
          </rect>
        );
      })}
      {data.some((d) => d.visitors > 0) && (
        <polyline
          points={visitorPoints}
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
            key={`f${d.day}`}
            x={xOf(i) + barW / 2}
            y={H - 7}
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

/** 把 /blog/xxx 换成文章标题，其它路径原样展示 */function labelPath(path: string, titles: Map<string, string>) {
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

export default async function StatsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  let overview: StatsOverview | null = null;
  let daily: DailyPoint[] = [];
  let topPaths: PathStat[] = [];
  let topRefs: ReferrerStat[] = [];
  let recent: RecentHit[] = [];
  let posts: PostMeta[] = [];
  let searchOverview: SearchOverview = { total: 0, today: 0, words: 0, zeroWords: 0 };
  let topSearches: SearchStat[] = [];
  let zeroSearches: SearchStat[] = [];
  let recentSearches: RecentSearch[] = [];
  let feedOverview: FeedOverview = {
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    readers: 0,
    visitors: 0,
    lastAt: "",
  };
  let feedDaily: FeedDay[] = [];
  let topReaders: ReaderStat[] = [];
  let recentFeed: RecentFeedHit[] = [];
  let dbError = "";

  try {
    [
      overview,
      daily,
      topPaths,
      topRefs,
      recent,
      posts,
      searchOverview,
      topSearches,
      zeroSearches,
      recentSearches,
      feedOverview,
      feedDaily,
      topReaders,
      recentFeed,
    ] = await Promise.all([
      getStatsOverview(),
      listDaily(30),
      listTopPaths(30, 10),
      listTopReferrers(30, 8),
      listRecentHits(20),
      listAll(),
      getSearchOverview(30),
      listTopSearches(30, 10),
      listZeroResultSearches(30, 8),
      listRecentSearches(15),
      getFeedOverview(30),
      listFeedDaily(30),
      listTopReaders(30, 8),
      listRecentFeedHits(12),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const h = await headers();
  const feedUrl = `${h.get("x-forwarded-proto") || "https"}://${
    h.get("host") || "blog.aixivi.cn"
  }/rss.xml`;

  const titles = new Map(posts.map((p) => [p.slug, p.title]));
  /** 浏览和搜索都没数据才显示空态，避免只跑了一半埋点时整页空白 */
  const noData =
    (!overview || overview.pv === 0) &&
    searchOverview.total === 0 &&
    feedOverview.total === 0;

  return (
    <>

{dbError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : noData ? (
        <div className="rounded-2xl border border-dashed border-[var(--c-border-3)] py-16 text-center">
          <p className="text-sm text-[var(--c-text-3)]">
            还没有任何访问数据。
          </p>
          <p className="mt-1 text-xs text-[var(--c-text-4)]">
            埋点已生效，打开前台任意页面产生一次浏览后，这里就会出现数据。
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
          >
            去前台看看 →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="累计浏览 PV"
              value={overview!.pv}
              sub={`累计访客 ${overview!.uv.toLocaleString("zh-CN")}`}
            />
            <Kpi
              label="今日"
              value={overview!.todayPv}
              sub={`访客 ${overview!.todayUv.toLocaleString("zh-CN")}`}
            />
            <Kpi
              label="近 7 天"
              value={overview!.weekPv}
              sub={`访客 ${overview!.weekUv.toLocaleString("zh-CN")}`}
            />
            <Kpi
              label="近 30 天"
              value={overview!.monthPv}
              sub={`访客 ${overview!.monthUv.toLocaleString("zh-CN")}`}
            />
          </div>

          {/* 趋势 */}
          <section className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={H2}>近 30 天趋势</h2>
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
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 热门页面 */}
            <section className={CARD}>
              <h2 className={H2}>热门页面 · 近 30 天</h2>
              <ol className="mt-4 space-y-2.5">
                {topPaths.map((t, i) => (
                  <li key={t.path} className="flex items-center gap-3">
                    <span
                      className={`w-5 shrink-0 text-center font-serif text-[15px] font-bold italic ${
                        i < 3 ? "text-[#FF6B35]" : "text-[var(--c-text-4)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <Link
                      href={t.path}
                      className="min-w-0 flex-1 truncate text-sm text-[var(--c-text)] transition-colors hover:text-[var(--brand-deep)]"
                      title={t.path}
                    >
                      {labelPath(t.path, titles)}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--c-text-3)]">
                      {t.pv.toLocaleString("zh-CN")}
                    </span>
                  </li>
                ))}
                {topPaths.length === 0 && (
                  <li className="text-xs text-[var(--c-text-4)]">暂无数据</li>
                )}
              </ol>
            </section>

            {/* 来源 */}
            <section className={CARD}>
              <h2 className={H2}>来源 · 近 30 天</h2>
              <ol className="mt-4 space-y-2.5">
                {topRefs.map((r) => (
                  <li key={r.referrer} className="flex items-center gap-3">
                    <span
                      className="min-w-0 flex-1 truncate text-sm text-[var(--c-text)]"
                      title={r.referrer}
                    >
                      {r.referrer}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--c-text-3)]">
                      {r.pv.toLocaleString("zh-CN")}
                    </span>
                  </li>
                ))}
                {topRefs.length === 0 && (
                  <li className="text-xs text-[var(--c-text-4)]">暂无数据</li>
                )}
              </ol>
            </section>
          </div>

          {/* 最近访问 */}
          <section className={CARD}>
            <h2 className={H2}>最近访问</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--c-border-2)] text-xs text-[var(--c-text-3)]">
                    <th className="pb-2 pr-4 font-medium">时间</th>
                    <th className="pb-2 pr-4 font-medium">页面</th>
                    <th className="pb-2 font-medium">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((h, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--c-border)] last:border-0"
                    >
                      <td className="whitespace-nowrap py-2 pr-4 text-xs tabular-nums text-[var(--c-text-3)]">
                        {cnTime(h.created_at)}
                      </td>
                      <td className="max-w-[240px] truncate py-2 pr-4 text-[var(--c-text)]">
                        {labelPath(h.path, titles)}
                      </td>
                      <td className="max-w-[200px] truncate py-2 text-xs text-[var(--c-text-3)]">
                        {h.referrer || "直接访问"}
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-xs text-[var(--c-text-4)]"
                      >
                        暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {/* 搜索词 */}
          <section className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={H2}>搜索词 · 近 30 天</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--c-text-3)]">
                <span>
                  共{" "}
                  <b className="tabular-nums text-[var(--c-text)]">
                    {searchOverview.total.toLocaleString("zh-CN")}
                  </b>{" "}
                  次
                </span>
                <span>今日 {searchOverview.today}</span>
                <span>独立词 {searchOverview.words}</span>
                <span
                  className={
                    searchOverview.zeroWords > 0 ? "text-[#FF6B35]" : undefined
                  }
                >
                  搜不到 {searchOverview.zeroWords}
                </span>
              </div>
            </div>

            {searchOverview.total === 0 ? (
              <p className="mt-4 text-xs text-[var(--c-text-4)]">
                还没有搜索记录。前台搜索页被使用后，这里会显示热门词与「搜不到的词」。
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  {/* 热门词 */}
                  <div>
                    <p className="text-xs font-medium text-[var(--c-text-3)]">
                      热门搜索
                    </p>
                    <ol className="mt-3 space-y-2.5">
                      {topSearches.map((t, i) => (
                        <li key={t.q} className="flex items-center gap-3">
                          <span
                            className={`w-5 shrink-0 text-center font-serif text-[15px] font-bold italic ${
                              i < 3 ? "text-[#FF6B35]" : "text-[var(--c-text-4)]"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <Link
                            href={`/search?q=${encodeURIComponent(t.q)}`}
                            className="min-w-0 flex-1 truncate text-sm text-[var(--c-text)] transition-colors hover:text-[var(--brand-deep)]"
                            title={t.q}
                          >
                            {t.q}
                          </Link>
                          <span className="shrink-0 text-xs tabular-nums text-[var(--c-text-3)]">
                            {t.hits} 次 · {t.visitors} 人
                          </span>
                        </li>
                      ))}
                      {topSearches.length === 0 && (
                        <li className="text-xs text-[var(--c-text-4)]">
                          暂无数据
                        </li>
                      )}
                    </ol>
                  </div>

                  {/* 无结果词 */}
                  <div>
                    <p className="text-xs font-medium text-[var(--c-text-3)]">
                      搜不到的词（值得考虑写一篇）
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {zeroSearches.map((t) => (
                        <li key={t.q} className="flex items-center gap-3">
                          <span
                            className="min-w-0 flex-1 truncate text-sm text-[#FF6B35]"
                            title={t.q}
                          >
                            {t.q}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-[var(--c-text-3)]">
                            {t.hits} 次
                          </span>
                        </li>
                      ))}
                      {zeroSearches.length === 0 && (
                        <li className="text-xs text-[var(--c-text-4)]">
                          每个搜索词都有命中 ✅
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {recentSearches.length > 0 && (
                  <div className="mt-6 border-t border-[var(--c-border-2)] pt-4">
                    <p className="text-xs font-medium text-[var(--c-text-3)]">
                      最近搜索
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {recentSearches.map((r, i) => (
                        <span
                          key={`${r.q}-${i}`}
                          title={cnTime(r.created_at)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            r.results === 0
                              ? "border-[#FFE0D0] bg-[#FFF7F2] text-[#FF6B35]"
                              : "border-[var(--c-border-3)] text-[var(--c-text-2)]"
                          }`}
                        >
                          {r.q}
                          <span className="ml-1.5 text-[var(--c-text-4)]">
                            {r.results} 篇
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* RSS 阅读数 */}
          <section className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={H2}>RSS 阅读 · 近 30 天</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--c-text-3)]">
                <span>
                  累计抓取{" "}
                  <b className="tabular-nums text-[var(--c-text)]">
                    {feedOverview.total.toLocaleString("zh-CN")}
                  </b>{" "}
                  次
                </span>
                <span>今日 {feedOverview.today}</span>
                <span>近 7 天 {feedOverview.week}</span>
                <span>独立阅读器 {feedOverview.readers}</span>
                <span>独立读者 {feedOverview.visitors}</span>
              </div>
            </div>

            {feedOverview.total === 0 ? (
              <p className="mt-4 text-xs text-[var(--c-text-4)]">
                还没有抓到订阅器取源记录。把下面的地址填进任意 RSS 阅读器（Feedly /
                Inoreader / 自建 FreshRSS 等）抓一次，这里就会出现数据。
                <br />
                <a
                  href={feedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[var(--brand-deep)] underline"
                >
                  {feedUrl}
                </a>
              </p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--c-text-3)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--brand)]" />
                    抓取次数
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2px] w-4 bg-[#111925]" />
                    独立读者
                  </span>
                </div>
                <div className="mt-3">
                  <FeedTrend data={feedDaily} />
                </div>

                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-[var(--c-text-3)]">
                      谁在读（按 UA 识别）
                    </p>
                    <ol className="mt-3 space-y-2.5">
                      {topReaders.map((r, i) => (
                        <li key={r.reader} className="flex items-center gap-3">
                          <span
                            className={`w-5 shrink-0 text-center font-serif text-[15px] font-bold italic ${
                              i < 3 ? "text-[#FF6B35]" : "text-[var(--c-text-4)]"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-[var(--c-text)]">
                            {r.reader}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-[var(--c-text-3)]">
                            {r.hits} 次 · {r.visitors} 人
                          </span>
                        </li>
                      ))}
                      {topReaders.length === 0 && (
                        <li className="text-xs text-[var(--c-text-4)]">暂无数据</li>
                      )}
                    </ol>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[var(--c-text-3)]">
                      最近抓取
                    </p>
                    <ul className="mt-3 space-y-2">
                      {recentFeed.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 text-xs"
                          title={r.ua}
                        >
                          <span className="shrink-0 tabular-nums text-[var(--c-text-4)]">
                            {cnTime(r.created_at)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[var(--c-text-2)]">
                            {r.reader}
                          </span>
                        </li>
                      ))}
                      {recentFeed.length === 0 && (
                        <li className="text-xs text-[var(--c-text-4)]">暂无数据</li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}

            <p className="mt-4 border-t border-[var(--c-border-2)] pt-3 text-xs leading-6 text-[var(--c-text-4)]">
              订阅地址：
              <a
                href={feedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand-deep)] underline"
              >
                {feedUrl}
              </a>
              <br />
              口径：RSS 阅读器取源一次记一次，同一阅读器反复拉取会重复计数（部分阅读器
              每 15 分钟拉一次），因此这是「订阅热度」而非「读完人数」；独立读者按
              IP + UA 匿名哈希去重，换网络会重复计数。
            </p>
          </section>
        </div>
      )}
    </>
  );
}
