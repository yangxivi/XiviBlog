import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import UpdatePanel from "../update-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "系统更新" };

export default async function UpdatePage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <>
      <UpdatePanel />
    </>
  );
}
