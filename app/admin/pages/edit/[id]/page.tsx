import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getPageById } from "@/lib/pages";
import AdminNav from "../../../admin-nav";
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
    <div className="mx-auto max-w-[var(--page-outer)] px-6 py-12">
      <AdminNav current="/admin/pages" />
      <h1 className="mb-6 text-2xl font-bold text-[var(--c-text)]">编辑页面</h1>
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
