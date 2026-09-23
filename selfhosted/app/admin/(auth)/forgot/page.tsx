import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import AuthShell from "../../auth-shell";
import AdminLogo from "../../admin-logo";
import ForgotForm from "./forgot-form";

export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  if (await isAuthenticated()) redirect("/admin");

  return (
    <AuthShell
      logo={<AdminLogo />}
      title="忘记密码"
      subtitle="验证管理员密码后即可重设"
    >
      <ForgotForm />
    </AuthShell>
  );
}
