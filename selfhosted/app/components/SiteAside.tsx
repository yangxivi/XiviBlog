import PromoStack from "./PromoStack";
import Recommend from "./Recommend";
import LatestComments from "./LatestComments";
import { listSidebarComments, type SidebarComment } from "@/lib/comments";
import { getSettings } from "@/lib/settings";
import type { PostMeta } from "@/lib/db";
import type { PromoCard } from "@/lib/settings";

/**
 * 右侧栏：橱窗卡片 + 推荐阅读 + 最新评论。
 * 「最新评论」的开关 / 标题 / 条数等来自后台「站点设置 → 最新评论」，
 * 这里自己读设置（读取失败不影响其它模块）。
 */
export default async function SiteAside({
  promos = [],
  logoText = "曦微",
  recommend = [],
  className = "",
}: {
  promos?: PromoCard[];
  logoText?: string;
  recommend?: PostMeta[];
  className?: string;
}) {
  const settings = await getSettings();
  const lc = settings.latestComments;

  let comments: SidebarComment[] = [];
  if (lc.enabled) {
    try {
      comments = await listSidebarComments(lc.count);
    } catch {
      comments = [];
    }
  }

  return (
    <aside className={`space-y-5 aside-col lg:sticky lg:top-[4.5rem] lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-auto scrollbar-hide ${className}`}>
      {/* 橱窗位：内容由后台「站点设置 → 侧边橱窗」配置 */}
      <PromoStack cards={promos} logoText={logoText} />

      {/* 推荐阅读 */}
      <Recommend posts={recommend} />

      {/* 最新评论：后台可关、可调标题与条数 */}
      <LatestComments
        items={comments}
        title={lc.title}
        showAvatar={lc.showAvatar}
        showPost={lc.showPost}
        showTime={lc.showTime}
        excerpt={lc.excerpt}
      />
    </aside>
  );
}
