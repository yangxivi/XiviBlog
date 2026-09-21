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

      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
<h1 className="text-base font-semibold text-white">留言评论</h1>
</div>

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
