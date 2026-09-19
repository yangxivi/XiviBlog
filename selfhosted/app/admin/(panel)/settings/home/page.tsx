import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listPublished } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import SettingsForm, { type PostOption } from "../settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "首页模块" };

export default async function HomeSettingsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  let postOptions: PostOption[] = [];
  try {
    postOptions = (await listPublished()).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      cover_image: p.cover_image,
      tag: p.tag,
    }));
  } catch {
    postOptions = [];
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">首页模块</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          首页轮播、侧边栏橱窗与「最新评论」模块配置
        </p>
      </div>

      <SettingsForm sections={["home"]} initial={settings} postOptions={postOptions} />
    </>
  );
}
