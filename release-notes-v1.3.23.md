# XiviBlog 自托管版 v1.3.23

## 修复：装完之后 /install 仍可访问（严重安全风险）

**现象**：安装向导跑完之后，`https://站点/install` 依然能打开重装表单；同时首页、
文章页等所有前台页面被 307 重定向到 `/install`（整站等于打不开）。

**根因**：判断「是否已安装」的逻辑放在了 `middleware.ts` 里，做法是让 middleware
自己去 HTTP 请求 `/api/install` 探测。middleware 运行在 edge 沙箱中，在
「Nginx 反向代理 + 隧道」这类部署形态下这个自探会失败，而失败被当成「未安装」，
于是两个后果同时出现：

1. 已安装的站点被整站重定向回 `/install`；
2. `/install` 长期对外暴露，任何人都能打开重装表单。

**修复**：安装状态判定整体下沉到 Node 运行时（能直连数据库），
middleware 不再做任何网络探测。

- 新增 `lib/install-lock.ts`：三层判定 —— 环境变量硬锁 → 安装标记文件
  `<数据库目录>/.installed` → `users` 表是否已有账号，命中任意一条即视为已安装。
- `app/install/page.tsx`：改为服务端组件，已安装直接 **404**；
  表单拆到 `app/install/install-form.tsx`（客户端）。
- `app/api/install/route.ts`：已安装拒绝安装（409；env 硬锁时为 403），
  安装成功后落盘 `.installed` 标记。
- `app/layout.tsx`：未安装时把访客引导到 `/install`（读取 middleware 透传的
  `x-pathname`，`/install` 自身放行，不会死循环）。
- `middleware.ts`：只保留「透传 pathname」这一个职责。
- `.env.example`：新增 `XIVIBLOG_INSTALL_LOCK=1`，装完可置 1 永久关闭安装向导。
