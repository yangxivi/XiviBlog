import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listPublished } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import AdminNav from "../admin-nav";
import SettingsForm, { type PostOption } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "站点设置" };

export default async function SettingsPage() {
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
    <div className="mx-auto max-w-[var(--page-outer)] px-6 py-10">
      <AdminNav current="/admin/settings" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">站点设置</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          站点名称、顶部导航与页脚内容，改完点保存即刻生效
        </p>
      </div>

      <SettingsForm initial={settings} postOptions={postOptions} />
    </div>
  );
}
