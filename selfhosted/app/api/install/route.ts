import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "@/lib/migrate";
import { createUser, countUsers } from "@/lib/users";
import { saveSettings } from "@/lib/settings";
import { getRawDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const n = await countUsers();
    return NextResponse.json({ installed: n > 0 });
  } catch {
    // 表尚未建立 → 尚未安装
    return NextResponse.json({ installed: false });
  }
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  // 已安装则拒绝重复安装
  try {
    if ((await countUsers()) > 0) {
      return NextResponse.json(
        { error: "博客已安装，无需重复安装。如需重置请清空数据库文件后重试。" },
        { status: 409 }
      );
    }
  } catch {
    /* 表还没建，继续安装流程 */
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
    try {
      const aboutMd = readFileSync(
        join(process.cwd(), "migrations", "_seed_about.md"),
        "utf8"
      );
      await saveSettings({ aboutTitle: "关于本站", aboutContent: aboutMd });
      seededAbout = true;
    } catch {
      /* 种子失败不影响安装 */
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
      seededAbout,
      seededPosts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `安装失败：${msg}` }, { status: 500 });
  }
}
