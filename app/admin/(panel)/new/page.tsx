import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Editor from "../editor";

export default async function NewPostPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");
  return (
    <Editor
      initial={{
        title: "",
        slug: "",
        excerpt: "",
        cover_image: "",
        cover_thumb: "",
        content: "",
        tag: "随笔",
        tags: "",
        status: "draft",
        pinned: false,
        publish_at: "",
      }}
    />
  );
}
