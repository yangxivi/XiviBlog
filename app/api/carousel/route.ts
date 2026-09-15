import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { listPublished, listCoverMap } from "@/lib/db";
import type { Slide } from "@/app/components/Carousel";

export const dynamic = "force-dynamic";

/**
 * 返回首页轮播所需 slides（含封面原图 base64）。
 * 由前端客户端异步拉取，避免把大图 base64 序列化进首屏 RSC flight 导致 hydration 局部失败。
 */
export async function GET() {
  const settings = await getSettings();
  const car = settings.carousel;

  let slides: Slide[] = [];

  if (car.mode === "custom" && car.slides.length > 0) {
    slides = car.slides
      .filter((s) => s.title.trim() || s.image.trim())
      .map((s, i) => ({
        key: `c${i}`,
        title: s.title,
        excerpt: s.excerpt,
        badge: s.badge,
        image: s.image,
        href: s.href || "/",
      }));
  } else {
    const allPosts = await listPublished();
    let covers: Record<number, string> = {};
    try {
      covers = await listCoverMap(car.count);
    } catch {
      covers = {};
    }
    slides = allPosts.slice(0, car.count).map((p) => ({
      key: `p${p.id}`,
      title: p.title,
      excerpt: p.excerpt,
      badge: p.tag,
      image: covers[p.id] ?? "",
      href: `/blog/${p.slug}`,
    }));
  }

  return NextResponse.json({ slides });
}
