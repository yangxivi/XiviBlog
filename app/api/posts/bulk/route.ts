import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDB, setRecommend, countRecommended, RECOMMEND_LIMIT } from "@/lib/db";

export const dynamic = "force-dynamic";

type BulkBody = { ids?: unknown; action?: unknown; tag?: unknown };

const ACTIONS = [
  "publish",
  "draft",
  "delete",
  "tag",
  "pin",
  "unpin",
  "recommend",
  "unrecommend",
] as const;
type Action = (typeof ACTIONS)[number];

/** 批量操作：发布 / 转草稿 / 改标签 / 置顶 / 取消置顶 / 删除 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as BulkBody | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
  }

  const rawIds = Array.isArray(body?.ids) ? body.ids : [];
  const ids = rawIds
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "未选择文章" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "单次最多 200 篇" }, { status: 400 });
  }

  const db = await getDB();

  try {
    if (action === "tag") {
      const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
      if (!tag) {
        return NextResponse.json({ error: "标签不能为空" }, { status: 400 });
      }
      const ph = ids.map((_, i) => `?${i + 2}`).join(",");
      const r = await db
        .prepare(
          `UPDATE posts SET tag=?1, updated_at=datetime('now') WHERE id IN (${ph})`
        )
        .bind(tag, ...ids)
        .run();
      return NextResponse.json({
        ok: true,
        affected: r.meta?.changes ?? ids.length,
      });
    }

    if (action === "delete") {
      const ph = ids.map((_, i) => `?${i + 1}`).join(",");
      const r = await db
        .prepare(`DELETE FROM posts WHERE id IN (${ph})`)
        .bind(...ids)
        .run();
      return NextResponse.json({
        ok: true,
        affected: r.meta?.changes ?? ids.length,
      });
    }

    if (action === "pin" || action === "unpin") {
      const pinned = action === "pin" ? 1 : 0;
      const ph = ids.map((_, i) => `?${i + 2}`).join(",");
      const r = await db
        .prepare(
          `UPDATE posts SET pinned=?1, updated_at=datetime('now') WHERE id IN (${ph})`
        )
        .bind(pinned, ...ids)
        .run();
      return NextResponse.json({
        ok: true,
        affected: r.meta?.changes ?? ids.length,
      });
    }

    if (action === "recommend" || action === "unrecommend") {
      if (action === "recommend") {
        // 名额校验：只统计「当前未推荐」的新增数量
        const current = await countRecommended();
        const ph = ids.map((_, i) => `?${i + 1}`).join(",");
        const already = await db
          .prepare(
            `SELECT COUNT(*) AS n FROM posts WHERE recommended=1 AND id IN (${ph})`
          )
          .bind(...ids)
          .first<{ n: number }>();
        const adding = ids.length - (already?.n ?? 0);
        if (current + adding > RECOMMEND_LIMIT) {
          return NextResponse.json(
            {
              error: `推荐名额不足：当前 ${current}/${RECOMMEND_LIMIT}，本次要加 ${adding} 篇。最多 ${RECOMMEND_LIMIT} 篇，请先取消其它推荐。`,
            },
            { status: 400 }
          );
        }
      }
      let affected = 0;
      let lastError = "";
      for (const id of ids) {
        const err = await setRecommend(id, action === "recommend");
        if (err) lastError = err;
        else affected += 1;
      }
      if (affected === 0 && lastError) {
        return NextResponse.json({ error: lastError }, { status: 400 });
      }
      return NextResponse.json({ ok: true, affected });
    }

    const status = action === "publish" ? "published" : "draft";
    const ph = ids.map((_, i) => `?${i + 2}`).join(",");
    const r = await db
      .prepare(
        `UPDATE posts SET status=?1, updated_at=datetime('now') WHERE id IN (${ph})`
      )
      .bind(status, ...ids)
      .run();
    return NextResponse.json({
      ok: true,
      affected: r.meta?.changes ?? ids.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `操作失败：${msg}` }, { status: 500 });
  }
}
