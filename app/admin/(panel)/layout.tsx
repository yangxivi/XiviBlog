import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import AdminSidebar from "./admin-sidebar";
import AdminLogo from "../admin-logo";

export const metadata: Metadata = {
  title: {
    template: "%s |后台管理",
    default: "后台管理",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  // 预取 settings（如有需要可在 layout 内使用，暂时留作占位）
  await getSettings();

  return (
    <div className="flex h-dvh min-h-0 bg-[var(--c-soft)]">
      {/* 左侧深色侧边栏：无异步依赖，立即可渲染 */}
      <AdminSidebar logo={<AdminLogo />} />

      {/* 右侧内容区 */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--c-soft)] p-4" style={{ scrollBehavior: 'smooth' }}>
        {/* Suspense 边界：深色背景立即显示，避免切换页面时白屏闪烁 */}
        <Suspense fallback={
          <div className="w-full min-h-[calc(100vh-3.5rem)] bg-[#1e293b]" />
        }>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
