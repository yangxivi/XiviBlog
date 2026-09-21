import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getPageById } from "@/lib/pages";
import PageEditor from "../../page-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "编辑页面" };

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const id = Number((await params).id);
  if (!id) notFound();

  const page = await getPageById(id);
  if (!page) notFound();

  return (
    <div>
      <div className="sticky top-0 z-20 h-14 border-b border-slate-700/60 bg-[#1e293b] flex items-center px-6">
<h1 className="text-base font-semibold text-white">编辑页面</h1>
</div>
      <PageEditor
        mode="edit"
        initial={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          show_in_nav: page.show_in_nav,
          nav_order: page.nav_order,
          allow_comments: page.allow_comments,
          header_title: page.header_title,
          header_tagline: page.header_tagline,
          header_desc: page.header_desc,
        }}
      />
    </div>
  );
}
