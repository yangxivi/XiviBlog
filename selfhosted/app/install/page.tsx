import { notFound } from "next/navigation";
import { installState } from "@/lib/install-lock";
import InstallForm from "./install-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "XiviBlog 安装向导",
  robots: { index: false, follow: false },
};

/**
 * 安装向导页面（服务端组件）。
 *
 * ⚠️ 安全闸门就在这里：安装状态的判断必须在 Node 运行时完成（能直连数据库），
 * 不能依赖 middleware 的 HTTP 自探——middleware 跑在 edge 沙箱里，自探失败
 * 会被误判成「未安装」，既让装好的站点被整站重定向回 /install，
 * 又把重装表单长期暴露在公网上。
 *
 * 判定命中即 404：对已安装的站点，/install 应当「不存在」。
 */
export default async function InstallPage() {
  const state = await installState();
  if (state.installed) notFound();
  return <InstallForm />;
}
