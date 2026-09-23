import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import MediaClient from "./media-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "媒体库" };

export default async function MediaPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <>

<MediaClient />
    </>
  );
}
