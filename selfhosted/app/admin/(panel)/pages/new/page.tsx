import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import PageEditor from "../page-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "新建页面" };

export default async function NewPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
<h1 className="text-2xl font-bold text-[var(--c-text)]">新建页面</h1>
</div>
      <PageEditor mode="new" />
    </div>
  );
}
