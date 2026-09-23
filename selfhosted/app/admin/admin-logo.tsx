import { getSettings } from "@/lib/settings";
import LogoMark from "../components/LogoMark";

/** 后台统一 LOGO：与前台页头同一 LogoMark + 同一 logoText 设置，保证两边一致 */
export default async function AdminLogo() {
  const settings = await getSettings();
  return (
    <a href="/" className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
      <LogoMark text={settings.logoText} className="h-10 w-10" />
    </a>
  );
}
