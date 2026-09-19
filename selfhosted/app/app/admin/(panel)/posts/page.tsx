import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listAll, type PostMeta } from "@/lib/db";
import PostsTable from "../posts-table";

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
    <>
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 flex items-center justify-between border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">文章管理</h1>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : (
        <PostsTable posts={posts} tags={tags} />
      )}
    </>
  );
}
