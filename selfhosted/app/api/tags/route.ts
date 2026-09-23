import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDB, listTagStats } from "@/lib/db";
import { getSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** 未分类名（删除分类时文章归入此分类） */
const UNTAGGED = "未分类";

/** 分类列表（含草稿计数与英文别名，需登录） */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const tags = await listTagStats();
  const settings = await getSettings();
  return NextResponse.json({ tags, untagged: UNTAGGED, aliases: settings.categoryAliases });
}

/** 设置某个分类的英文别名（to 为空串表示删除别名） */
async function setAlias(from: string, to: string) {
  const settings = await getSettings();
  const aliases = { ...settings.categoryAliases };
  if (to) {
    // 同一别名不允许挂在两个分类上
    for (const [zh, en] of Object.entries(aliases)) {
      if (en.toLowerCase() === to.toLowerCase() && zh !== from) {
        return `别名「${to}」已被分类「${zh}」使用`;
      }
    }
    aliases[from] = to;
  } else {
    delete aliases[from];
  }
  await saveSettings({ categoryAliases: aliases });
  return null;
}

/** 分类操作后同步维护别名映射 */
async function syncAliasesOnRename(fromList: string[], to: string) {
  const settings = await getSettings();
  const aliases = { ...settings.categoryAliases };
  for (const from of fromList) {
    if (from === to) continue;
    if (aliases[from] && !aliases[to]) aliases[to] = aliases[from];
    delete aliases[from];
  }
  await saveSettings({ categoryAliases: aliases });
}

async function syncAliasesOnRemove(fromList: string[], keep?: string) {
  const settings = await getSettings();
  const aliases = { ...settings.categoryAliases };
  for (const from of fromList) {
    if (from === keep) continue;
    delete aliases[from];
  }
  await saveSettings({ categoryAliases: aliases });
}

type Body = { action?: unknown; from?: unknown; to?: unknown };

/** 重命名 / 合并 / 删除分类 / 设置英文别名 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const fromList = (Array.isArray(body?.from) ? body.from : [body?.from])
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (fromList.length === 0) {
    return NextResponse.json({ error: "请选择分类" }, { status: 400 });
  }

  const db = await getDB();

  try {
    if (action === "alias") {
      const to = typeof body?.to === "string" ? body.to.trim() : "";
      if (to.length > 60) {
        return NextResponse.json({ error: "别名过长（最多 60 字符）" }, { status: 400 });
      }
      if (fromList.length !== 1) {
        return NextResponse.json({ error: "一次只能设置一个分类的别名" }, { status: 400 });
      }
      const err = await setAlias(fromList[0], to);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      return NextResponse.json({ ok: true, to });
    }

    if (action === "rename" || action === "merge") {
      const to = typeof body?.to === "string" ? body.to.trim() : "";
      if (!to) return NextResponse.json({ error: "新分类名不能为空" }, { status: 400 });
      if (to.length > 30) return NextResponse.json({ error: "分类名过长" }, { status: 400 });

      let affected = 0;
      for (const from of fromList) {
        if (from === to) continue;
        const r = await db
          .prepare("UPDATE posts SET tag=?1, updated_at=datetime('now') WHERE tag=?2")
          .bind(to, from)
          .run();
        affected += r.meta?.changes ?? 0;
      }
      if (action === "rename") await syncAliasesOnRename(fromList, to);
      else await syncAliasesOnRemove(fromList, to);
      return NextResponse.json({ ok: true, affected, to });
    }

    if (action === "delete") {
      let affected = 0;
      for (const from of fromList) {
        const r = await db
          .prepare("UPDATE posts SET tag=?1, updated_at=datetime('now') WHERE tag=?2")
          .bind(UNTAGGED, from)
          .run();
        affected += r.meta?.changes ?? 0;
      }
      await syncAliasesOnRemove(fromList, UNTAGGED);
      return NextResponse.json({ ok: true, affected, to: UNTAGGED });
    }

    return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `操作失败：${msg}` }, { status: 500 });
  }
}
