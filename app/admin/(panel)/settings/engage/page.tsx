import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForm from "../settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "公告友链" };

export default async function EngageSettingsPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <>
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-slate-700/60 bg-[#1e293b] px-6 py-3">
<h1 className="text-base font-semibold text-white">公告友链</h1>
</div>

      <SettingsForm sections={["engage"]} initial={settings} postOptions={[]} />
    </>
  );
}
