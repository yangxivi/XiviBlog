/**
 * 后台布局加载占位。
 * 不再使用骨架屏：内容区加载期间直接显示背景填色，保持视觉连续、不闪骨架。
 */
export default function AdminLoading() {
  return <div className="min-h-[70vh] bg-[var(--c-soft)]" />;
}
