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
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">AI 工具</h1>
        <p className="mt-1 text-sm text-[var(--c-text-3)]">
          AI 封面与 AI 排版的接口配置（也可通过环境变量设置，不入库）
        </p>
      </div>

      <SettingsForm sections={["ai"]} initial={settings} postOptions={[]} />
    </>
  );
}
