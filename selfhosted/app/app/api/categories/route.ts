import { isAuthenticated } from "@/lib/auth";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 返回所有出现过的分类（含草稿），用于编辑器下拉选择 */
export async function GET(): Promise<Response> {
  if (!(await isAuthenticated())) {
    return Response.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        "SELECT tag, COUNT(*) as count FROM posts GROUP BY tag ORDER BY count DESC, tag ASC"
      )
      .all<{ tag: string; count: number }>();

    const categories =
      results
        ?.map((r) => r.tag)
        .filter(Boolean)
        .map((tag) => ({ name: tag, slug: tag })) ?? [];

    return Response.json({ ok: true, categories });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
