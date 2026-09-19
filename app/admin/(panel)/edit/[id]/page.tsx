import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getById } from "@/lib/db";
import Editor from "../../editor";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");
  const { id } = await params;
  const post = await getById(Number(id));
  if (!post) notFound();
  return (
    <Editor
      initial={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        cover_image: post.cover_image,
        cover_thumb: (post as unknown as { cover_thumb?: string }).cover_thumb || "",
        content: post.content,
        tag: post.tag,
        tags: post.tags || "",
        status: post.status,
        pinned: !!post.pinned,
        publish_at: post.publish_at || "",
      }}
    />
  );
}
