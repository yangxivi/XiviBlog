import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  listChecks,
  runChecks,
  staleHrefs,
  summarizeFriends,
} from "@/lib/friends";
import { normalizeFriendUrl } from "@/lib/friend-url";

export const dynamic = "force-dynamic";

/** 现有检测结果 + 友链清单 + 汇总（打开设置页时一次性拿到） */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  try {
    const settings = await getSettings();
    const checks = await listChecks();
    const stale = await staleHrefs();
    return NextResponse.json({
      ok: true,
      friends: settings.friends,
      checks,
      summary: summarizeFriends(settings.friends, checks),
      stale,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `读取失败：${msg}` }, { status: 500 });
  }
}

/**
 * 发起检测。
 *  body.hrefs  —— 指定要检测的地址（支持还没保存的表单值）
 *  body.mode   —— "all" 全量重测（默认）/ "stale" 只测过期的
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    hrefs?: unknown;
    mode?: string;
  } | null;

  try {
    const settings = await getSettings();
    const saved = [
      ...new Set(
        settings.friends.map((f) => normalizeFriendUrl(f.href)).filter(Boolean)
      ),
    ];

    let targets: string[];
    let prune = false;
    if (Array.isArray(body?.hrefs) && body.hrefs.length) {
      // 指定子集（面板补测 / 未保存的表单值）：绝不 prune，否则会误删其它正常链接记录
      targets = body.hrefs.map((h) => normalizeFriendUrl(String(h))).filter(Boolean);
    } else if (body?.mode === "stale") {
      // 只测过期的子集：绝不 prune
      targets = await staleHrefs();
    } else {
      // 全量（等于完整友链集合）：可以安全 prune 以回收孤儿行
      targets = saved;
      prune = true;
    }

    if (!targets.length) {
      const checks = await listChecks();
      return NextResponse.json({
        ok: true,
        checked: 0,
        checks,
        summary: summarizeFriends(settings.friends, checks),
      });
    }

    await runChecks(targets, { prune });

    const checks = await listChecks();
    return NextResponse.json({
      ok: true,
      checked: targets.length,
      checks,
      summary: summarizeFriends(settings.friends, checks),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `检测失败：${msg}` }, { status: 500 });
  }
}
