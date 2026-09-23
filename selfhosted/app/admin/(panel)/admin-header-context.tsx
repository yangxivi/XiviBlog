"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * 用于在页面层级共享 header 尺寸和 sticky 状态
 * 供需要感知 header 位置的组件使用
 */
export interface HeaderContextType {
  /** header 高度（px），默认 56（h-14） */
  height: number;
  /** 是否 sticky */
  sticky: boolean;
}

const HeaderContext = createContext<HeaderContextType>({
  height: 56,
  sticky: true,
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  return (
    <HeaderContext.Provider value={{ height: 56, sticky: true }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  return useContext(HeaderContext);
}
