/**
 * 后台路由切换时的骨架屏。
 * 后台页面都是 force-dynamic，切页时要等 Worker + D1，没有这个会短暂看到空白页，
 * 容易被误认为「页面到底了」。
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-6 py-10">
      <div className="mb-6 h-[52px] animate-pulse rounded-xl bg-[var(--c-fill)]" />
      <div className="mb-8 space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--c-fill)]" />
        <div className="h-4 w-72 animate-pulse rounded bg-[var(--c-fill)]" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-soft)]"
          />
        ))}
      </div>
    </div>
  );
}
