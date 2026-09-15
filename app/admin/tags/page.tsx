import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listTagStats, type TagStat } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import AdminNav from "../admin-nav";
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
    <div className="mx-auto max-w-[var(--page-outer)] px-6 py-12">
      <AdminNav current="/admin/tags" />
      <h1 className="mb-1 text-2xl font-bold text-[var(--c-text)]">分类管理</h1>
      <p className="mb-6 text-sm text-[var(--c-text-3)]">
        共 {tags.length} 个分类
      </p>

      {dbError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          数据库错误：{dbError}
        </div>
      ) : (
        <TagsClient tags={tags} untagged="未分类" aliases={aliases} />
      )}
    </div>
  );
}
