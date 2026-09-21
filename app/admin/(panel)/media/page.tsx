import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import MediaClient from "./media-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "媒体库" };

export default async function MediaPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <>

      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
<h1 className="text-base font-semibold text-white">媒体库</h1>
</div>
      <MediaClient />
    </>
  );
}
