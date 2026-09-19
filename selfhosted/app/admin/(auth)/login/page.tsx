import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import AuthShell from "../../auth-shell";
import AdminLogo from "../../admin-logo";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  if (await isAuthenticated()) redirect(sp.next || "/admin");

  return (
    <AuthShell
      logo={<AdminLogo />}
      title="登录后台"
      subtitle="曦微博客系统 管理后台"
    >
      {sp.reset === "1" && (
        <div className="mb-4 rounded-lg border border-[var(--c-brand-border)] bg-[var(--c-brand-soft)] px-3.5 py-2.5 text-sm text-[var(--brand-deep)]">
          密码已重置，请用新密码登录。
        </div>
      )}
      <LoginForm next={sp.next || ""} />
    </AuthShell>
  );
}
