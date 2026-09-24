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
