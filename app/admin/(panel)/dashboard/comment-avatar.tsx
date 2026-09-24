"use client";

import { useState } from "react";

/**
 * 留言头像：有头像显示图片（加载失败自动回落到首字母），
 * 无头像直接显示首字母色块。
 * 必须是客户端组件——onError 事件处理器不能出现在服务端组件的 props 里。
 */
export default function CommentAvatar({
  avatar,
  nickname,
}: {
  avatar?: string | null;
  nickname: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = nickname.slice(0, 1);

  if (avatar && avatar.trim() && !broken) {
    return (
      <img
        src={avatar}
        alt=""
        className="h-6 w-6 rounded-full"
        width={24}
        height={24}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)]">
      {initial}
    </div>
  );
}
