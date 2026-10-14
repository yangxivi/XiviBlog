import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AccountForm from "./account-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "账号管理" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <AccountForm user={user} />
    </>
  );
}