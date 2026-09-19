import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import AuthShell from "../../auth-shell";
import AdminLogo from "../../admin-logo";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await isAuthenticated()) redirect("/admin");

  return (
    <AuthShell
      logo={<AdminLogo />}
      title="注册账号"
      subtitle="需要注册邀请码，仅站主与团队成员可创建"
    >
      <RegisterForm />
    </AuthShell>
  );
}
