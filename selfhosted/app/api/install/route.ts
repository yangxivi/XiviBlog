import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "@/lib/migrate";
import { createUser } from "@/lib/users";
import { saveSettings } from "@/lib/settings";
import { getRawDb } from "@/lib/db";
import {
  installState,
  writeInstallMarker,
  isInstallLockedByEnv,
} from "@/lib/install-lock";

export const dynamic = "force-dynamic";

/**
 * 安装接口。
 *
 * ⚠️ 这里是「重复安装」的最后一道闸门，必须在 Node 运行时判断（直连数据库）。
 * 安装状态统一走 lib/install-lock.ts：环境变量硬锁 → 安装标记文件 → users 表非空，
 * 命中任意一条即拒绝安装。
 *
 * 装完后 /install 页面会 404（见 app/install/page.tsx），但接口这一层仍要独立拒绝：
 * 页面被绕过时也不能让人重建管理员账号。
 */
export async function GET() {
  const state = await installState();
  return NextResponse.json({
    installed: state.installed,
    reason: state.reason,
    locked: isInstallLockedByEnv(),
  });
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  // 已安装（或已被 env 硬锁）则拒绝重复安装
  const state = await installState();
  if (state.installed) {
    const locked = state.reason === "env-lock";
    return NextResponse.json(
      {
        error: locked
          ? "安装向导已被关闭（XIVIBLOG_INSTALL_LOCK=1），如需重装请先移除该环境变量并清空数据库与安装标记。"
          : "博客已安装，安装向导已关闭。如需重装请清空数据库文件与安装标记后重启服务。",
        installed: true,
        reason: state.reason,
      },
      { status: locked ? 403 : 409 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    confirm?: string;
    siteName?: string;
  } | null;

  const email = (body?.email || "").trim();
  const password = body?.password || "";
  const confirm = body?.confirm || "";
  const siteName = (body?.siteName || "").trim();

  if (!isEmail(email))
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "密码至少需要 6 位" }, { status: 400 });
  if (password !== confirm)
    return NextResponse.json({ error: "两次输入的密码不一致" }, { status: 400 });

  try {
    // 1) 执行数据库迁移（建表）
    const { files } = runMigrations();
    // 2) 创建管理员账号
    const uid = await createUser({
      email,
      name: email.split("@")[0],
      password,
      role: "admin",
    });
    // 2.5) 落盘安装标记：即使之后 users 表被清空，也无法再走一遍安装流程
    const markerWritten = writeInstallMarker();
    // 3) 可选：写入站点名称
    if (siteName) {
      try {
        await saveSettings({ siteName });
      } catch {
        /* 站点名写入失败不影响安装 */
      }
    }
    // 4) 种子内容：「关于本站」（与 blog.aixivi.cn/about 一致的完整文案）
    let seededAbout = false;
    let aboutMd = "";
    try {
      aboutMd = readFileSync(
        join(process.cwd(), "migrations", "_seed_about.md"),
        "utf8"
      );
      await saveSettings({ aboutTitle: "关于本站", aboutContent: aboutMd });
      seededAbout = true;
    } catch {
      /* 种子失败不影响安装 */
    }
    // 4.5) 把「关于本站」种进页面管理（slug=about，即 /about 的内容源，
    //       后台「页面管理」可直接编辑；show_in_nav=0，导航入口由默认设置提供）
    let seededAboutPage = false;
    if (aboutMd) {
      try {
        const db = getRawDb();
        const exists = db
          .prepare("SELECT id FROM pages WHERE slug='about'")
          .get();
        if (!exists) {
          db.prepare(
            "INSERT INTO pages (slug, title, content, show_in_nav, nav_order, allow_comments) VALUES ('about', '关于本站', ?, 0, 99, 1)"
          ).run(aboutMd);
        }
        seededAboutPage = true;
      } catch {
        /* 页面种子失败不影响安装 */
      }
    }
    // 5) 种子内容：20 篇样本文章（仅在文章表为空时写入）
    let seededPosts = 0;
    try {
      const db = getRawDb();
      const row = db.prepare("SELECT COUNT(*) AS c FROM posts").get() as
        | { c: number }
        | undefined;
      if (!row || row.c === 0) {
        const seedSql = readFileSync(
          join(process.cwd(), "migrations", "_seed_posts20.sql"),
          "utf8"
        );
        db.exec(seedSql);
        seededPosts = 20;
      }
    } catch {
      /* 种子失败不影响安装 */
    }
    return NextResponse.json({
      ok: true,
      userId: uid,
      migrations: files.length,
      markerWritten,
      seededAbout,
      seededAboutPage,
      seededPosts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `安装失败：${msg}` }, { status: 500 });
  }
}
