"use client";

import { createContext, useContext, type ReactNode } from "react";

/** 服务端在 layout 注入当前是否登录后台，所有客户端组件可读取 */
const AdminContext = createContext<boolean>(false);

export function AdminProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: ReactNode;
}) {
  return (
    <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>
  );
}

/** 当前是否以后台登录态访问前台（用于显示「编辑」等站长入口） */
export function useIsAdmin(): boolean {
  return useContext(AdminContext);
}
