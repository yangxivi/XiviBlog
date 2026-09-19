import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import MediaClient from "./media-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "媒体库" };

export default async function MediaPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <>

      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
<h1 className="text-2xl font-bold text-[var(--c-text)]">媒体库</h1>
<p className="mt-1 text-sm text-[var(--c-text-3)]">
        汇总所有文章用到的封面图，可查看引用、复制地址、解除引用。
      </p>
</div>
      <MediaClient />
    </>
  );
}
