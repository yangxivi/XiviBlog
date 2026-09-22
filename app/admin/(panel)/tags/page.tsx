import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listTagStats, type TagStat } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import TagsClient from "./tags-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "分类管理" };

export default async function TagsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  let tags: TagStat[] = [];
  let aliases: Record<string, string> = {};
  let dbError = "";
  try {
    [tags, aliases] = await Promise.all([
      listTagStats(),
      getSettings().then((s) => s.categoryAliases),
    ]);
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
        <TagsClient tags={tags} untagged="未分类" aliases={aliases} />
      )}
    </>
  );
}
