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
<SettingsForm sections={["engage"]} initial={settings} postOptions={[]} />
    </>
  );
}
