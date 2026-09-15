import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  addComment,
  deleteComment,
  isRateLimited,
  isValidPageKey,
  listComments,
} from "@/lib/comments";

/** 游客身份池：形容词 + 海洋动物，亲和且不重复率高 */
const ADJ = [
  "快乐的", "爱折腾的", "打瞌睡的", "好奇的", "机智的", "安静的", "飞快的",
  "感冒的", "无敌的", "深夜出没的", "喝可乐的", "摸鱼的", "爱学习的", "慷慨的",
  "勤奋的", "悠闲的", "神秘兮兮的", "一脸懵的", "热血的", "淡定的",
];
const ANIMALS = [
  "水母", "河豚", "章鱼", "海獭", "企鹅", "鲸鱼", "海豚", "水獭", "海豹", "龙虾",
  "小丑鱼", "寄居蟹", "海星", "北极熊", "白鲸", "海龟", "灯塔鱼", "飞鱼", "海马", "蓝鲸",
];
const EMOJIS = [
  "🐳", "🐙", "🦈", "🐬", "🐋", "🦑", "🐠", "🐡", "🦀", "🐢",
  "🦭", "🐧", "⭐", "🌊", "🫧", "🪼", "🦐", "🐋",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 生成随机游客身份 */
function makeIdentity(): { nickname: string; avatar: string } {
  return { nickname: pick(ADJ) + pick(ANIMALS), avatar: pick(EMOJIS) };
}

async function ipHashOf(req: NextRequest): Promise<string> {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`xivi-comment:${ip}`)
  );
  return Array.from(new Uint8Array(buf.slice(0, 12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** GET /api/comments?page=about|post:1 — 前台拉取留言列表 */
export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get("page") || "";
  if (!isValidPageKey(page)) {
    return NextResponse.json({ error: "页面标识不正确" }, { status: 400 });
  }
  return NextResponse.json({ comments: await listComments(page) });
}

/** POST /api/comments — 免注册留言；身份缺省时由系统生成并返回 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    page?: string;
    content?: string;
    nickname?: string;
    avatar?: string;
  } | null;
  if (!body || !isValidPageKey(body.page || "")) {
    return NextResponse.json({ error: "页面标识不正确" }, { status: 400 });
  }
  const content = (body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "说点什么再提交吧" }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: "最多 500 字" }, { status: 400 });
  }

  const hash = await ipHashOf(req);
  if (await isRateLimited(hash)) {
    return NextResponse.json(
      { error: "发得太快啦，休息一分钟再来" },
      { status: 429 }
    );
  }

  // 身份：客户端带来了就用客户端的（浏览器持久化），否则系统生成
  let nickname = (body.nickname || "").trim().slice(0, 20);
  let avatar = (body.avatar || "").trim().slice(0, 8);
  let generated = false;
  if (!nickname || !avatar) {
    const id = makeIdentity();
    nickname = nickname || id.nickname;
    avatar = avatar || id.avatar;
    generated = true;
  }

  const item = await addComment(body.page!, nickname, avatar, content, hash);
  return NextResponse.json({ ok: true, comment: item, generated });
}

/** DELETE /api/comments?id=1 — 后台删除（需登录） */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  const ok = await deleteComment(id);
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
