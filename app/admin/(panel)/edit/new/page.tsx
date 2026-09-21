import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Editor from "../../editor";
import type { EditorPost } from "../../editor";

export const dynamic = "force-dynamic";

const EMPTY_POST: EditorPost = {
  title: "",
  slug: "",
  excerpt: "",
  cover_image: "",
  cover_thumb: "",
  content: "",
  tag: "",
  tags: "",
  status: "draft",
  pinned: false,
  publish_at: "",
};

export default async function NewPostPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return <Editor initial={EMPTY_POST} />;
}
