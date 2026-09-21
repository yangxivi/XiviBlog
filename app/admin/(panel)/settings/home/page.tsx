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
      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
<h1 className="text-base font-semibold text-white">首页模块</h1>
</div>

      <SettingsForm sections={["home"]} initial={settings} postOptions={postOptions} />
    </>
  );
}
