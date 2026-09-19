import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import PageEditor from "../page-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "新建页面" };

export default async function NewPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--c-text)]">新建页面</h1>
      <PageEditor mode="new" />
    </div>
  );
}
