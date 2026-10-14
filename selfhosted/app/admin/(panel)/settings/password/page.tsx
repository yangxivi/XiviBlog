import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "修改密码" };

export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <PasswordForm email={user.email} />
    </>
  );
}