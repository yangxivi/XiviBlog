import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForm from "../settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI 工具" };

export default async function AiSettingsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">AI 工具</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          AI 封面与 AI 排版的接口配置（也可通过环境变量设置，不入库）
        </p>
      </div>

      <SettingsForm sections={["ai"]} initial={settings} postOptions={[]} />
    </>
  );
}
