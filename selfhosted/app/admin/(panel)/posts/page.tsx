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
      <div className="sticky top-0 z-20  mb-6 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
        <h1 className="text-base font-semibold text-white">文章管理</h1>
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
