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

      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 py-2">
<h1 className="text-base font-bold text-[var(--c-text)]">分类管理</h1>
</div>

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
