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
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--c-border)] bg-[var(--c-page)] px-6 pb-4 pt-5">
<h1 className="text-2xl font-bold text-[var(--c-text)]">编辑页面</h1>
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
