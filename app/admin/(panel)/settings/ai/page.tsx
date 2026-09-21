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
      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
<h1 className="text-base font-semibold text-white">AI 工具</h1>
</div>

      <SettingsForm sections={["ai"]} initial={settings} postOptions={[]} />
    </>
  );
}
