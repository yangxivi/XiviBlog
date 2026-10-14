import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "账号管理" };

/** 旧地址（修改密码）已升级为「账号管理」，重定向保持兼容 */
export default function PasswordPageRedirect() {
  redirect("/admin/settings/account");
}