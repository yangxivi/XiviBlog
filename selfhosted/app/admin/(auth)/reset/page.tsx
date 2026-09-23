import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import AuthShell from "../../auth-shell";
import AdminLogo from "../../admin-logo";
import ResetForm from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  if (await isAuthenticated()) redirect("/admin");

  return (
    <AuthShell
      logo={<AdminLogo />}
      title="重置密码"
      subtitle="设置一个新的登录密码"
    >
      <ResetForm token={sp.token ?? ""} />
    </AuthShell>
  );
}
