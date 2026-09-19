import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { countComments, listRecentComments, type CommentRow } from "@/lib/comments";
import CommentsClient from "./comments-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "留言评论" };

export default async function AdminCommentsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  let rows: CommentRow[] = [];
  let total = 0;
  let dbError = "";
  try {
    rows = await listRecentComments(100);
    total = await countComments();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <>

      <h1 className="mb-1 text-2xl font-bold text-[var(--c-text)]">留言评论</h1>
      <p className="mb-6 text-sm text-[var(--c-text-3)]">
        共 {total} 条，显示最新 {rows.length} 条
      </p>

      {dbError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : (
        <CommentsClient rows={rows} />
      )}
    </>
  );
}
