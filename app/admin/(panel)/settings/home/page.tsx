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

      <SettingsForm sections={["home"]} initial={settings} postOptions={postOptions} />
    </>
  );
}
