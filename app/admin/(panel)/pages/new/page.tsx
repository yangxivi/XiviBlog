import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import PageEditor from "../page-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "新建页面" };

export default async function NewPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <div>
      <div className="sticky top-0 z-20  mb-6 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
<h1 className="text-base font-semibold text-white">新建页面</h1>
</div>
      <PageEditor mode="new" />
    </div>
  );
}
