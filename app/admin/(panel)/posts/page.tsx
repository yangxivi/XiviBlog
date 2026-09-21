import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { listAll, type PostMeta } from "@/lib/db";
import PostsTable from "../posts-table";
import PageWithHeader from "../page-with-header";

export const metadata: Metadata = { title: "文章管理" };
export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  let posts: PostMeta[] = [];
  let dbError = "";
  try {
    posts = await listAll();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const tags = [...new Set(posts.map((p) => p.tag).filter(Boolean))].sort();

  return (
    <PageWithHeader
      title="文章管理"
      action={
        <Link
          href="/admin/edit/new"
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          + 新文章
        </Link>
      }
    >
      {dbError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : (
        <PostsTable posts={posts} tags={tags} />
      )}
    </PageWithHeader>
  );
}
