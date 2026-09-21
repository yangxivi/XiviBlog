"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type AdminHeaderContextType = {
  title?: ReactNode;
  action?: ReactNode;
};

export const AdminHeaderContext = createContext<AdminHeaderContextType>({});

export function useAdminHeader() {
  return useContext(AdminHeaderContext);
}

export function AdminHeaderProvider({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminHeaderContext.Provider value={{ title, action }}>
      {children}
    </AdminHeaderContext.Provider>
  );
}
