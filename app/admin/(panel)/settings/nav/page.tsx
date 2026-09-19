import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForm from "../settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "导航菜单" };

export default async function NavSettingsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <>
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">导航菜单</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          维护顶部导航项，站内写 / 开头，站外写完整地址
        </p>
      </div>

      <SettingsForm sections={["nav"]} initial={settings} postOptions={[]} />
    </>
  );
}
