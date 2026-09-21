import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import AdminSidebar from "./admin-sidebar";
import AdminLogo from "../admin-logo";

export const metadata: Metadata = {
  title: {
    template: "%s | 后台管理",
    default: "后台管理",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <div className="flex h-dvh min-h-0 bg-[var(--c-soft)]">
      {/* ── 左侧深色侧边栏（可折叠 + 分组折叠 + 图标） ───────────── */}
      <AdminSidebar logo={<AdminLogo />} />

      {/* ── 右侧内容区 ───────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
        <div className="px-6 pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
