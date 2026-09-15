import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { listAll, type PostMeta } from "@/lib/db";
import AdminNav from "./admin-nav";
import LogoutButton from "./logout-button";
import PostsTable from "./posts-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "文章管理" };

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const user = await getCurrentUser();
  let posts: PostMeta[] = [];
  let dbError = "";
  try {
    posts = await listAll();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const tags = [...new Set(posts.map((p) => p.tag).filter(Boolean))].sort();

  return (
    <div className="mx-auto max-w-[var(--page-outer)] px-6 py-12">
      {/* 当前账号 */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--c-border-2)] bg-[var(--c-soft)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-[var(--brand-ink)]">
            {(user?.name || user?.email || "X").slice(0, 1).toUpperCase()}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium text-[var(--c-text)]">
              {user?.name || "管理员"}
            </p>
            <p className="text-xs text-[var(--c-text-3)]">
              {user?.email || "兼容会话（旧密码登录）"}
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>

      <AdminNav current="/admin" />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">文章管理</h1>
        <Link
          href="/admin/new"
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)]"
        >
          + 新文章
        </Link>
      </div>

      {dbError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : (
        <PostsTable posts={posts} tags={tags} />
      )}
    </div>
  );
}
