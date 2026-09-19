import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForm from "./settings-form";
import UpdatePanel from "./update-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "基础信息" };

export default async function SettingsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">基础信息</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          站点名称、LOGO、描述与主题，改完点保存即刻生效
        </p>
      </div>

      {/* 系统更新（selfhosted 专属） */}
      <div className="mt-10">
        <UpdatePanel />
      </div>

      <SettingsForm sections={["basic"]} initial={settings} postOptions={[]} />
    </>
  );
}
