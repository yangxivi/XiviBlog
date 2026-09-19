import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForm from "../settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "页脚设置" };

export default async function FooterSettingsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">页脚设置</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          页脚品牌区、二维码、链接分组与版权信息
        </p>
      </div>

      <SettingsForm sections={["footer"]} initial={settings} postOptions={[]} />
    </>
  );
}
