import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listPages } from "@/lib/pages";
import DeletePageButton from "./delete-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "页面管理" };

export default async function AdminPages() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const pages = await listPages();

  return (
    <>


      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-slate-700/60 bg-[#1e293b] px-6 py-2">
        <h1 className="text-base font-semibold text-white leading-none">页面管理</h1>
      </div>

      <p className="mb-4 text-sm text-[var(--c-text-3)]">
        这里的「页面」是独立单页（留言板、友链页、说明页等），区别于按时间排序的文章。
        勾选「显示在导航」后会出现在顶部导航栏，可开启留言区。
      </p>

      <div className="overflow-hidden rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-soft)]">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-[var(--c-border-2)] px-4 py-3 text-xs font-medium text-[var(--c-text-3)]">
          <span>标题 / 路径</span>
          <span className="w-16 text-center">导航</span>
          <span className="w-16 text-center">留言</span>
          <span className="w-12" />
          <span className="w-12" />
        </div>

        {pages.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--c-text-4)]">
            还没有自定义页面，点右上角「新建页面」创建一个吧
          </p>
        ) : (
          pages.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-[var(--c-border-2)] px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--c-text)]">
                  {p.title}
                </p>
                <p className="truncate text-xs text-[var(--c-text-3)]">
                  /{p.slug}
                </p>
              </div>
              <span className="w-16 text-center text-sm">
                {p.show_in_nav === 1 ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="text-[var(--c-text-4)]">—</span>
                )}
              </span>
              <span className="w-16 text-center text-sm">
                {p.allow_comments === 1 ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="text-[var(--c-text-4)]">—</span>
                )}
              </span>
              <Link
                href={`/admin/pages/edit/${p.id}`}
                className="w-12 rounded-lg border border-[var(--c-border-3)] px-2.5 py-1 text-center text-xs text-[var(--c-text-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
              >
                编辑
              </Link>
              <DeletePageButton id={p.id} title={p.title} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
