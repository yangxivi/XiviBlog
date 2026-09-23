# XiviBlog Cloud Studio 部署指南

## 方案概述

在腾讯云 Cloud Studio（云端 IDE）上运行 XiviBlog 自托管版，实现**零成本、永久在线**的博客服务。

### 优势
- ✅ 免费：每月 50000 分钟免费时长，实际约 555 小时
- ✅ 持久：工作空间长期保留（需定期登录激活）
- ✅ 快速：腾讯云国内镜像，依赖安装秒级完成
- ✅ 稳定：2C4G 配置，运行稳定

### 限制
- ⚠️ 需定期登录（建议每周至少登录一次激活）
- ⚠️ 公网 IP 可能变化（需配合端口映射访问）
- ⚠️ 不能绑定自定义域名到 3000 端口

---

## 一、创建工作空间

### 1. 登录 Cloud Studio
访问 https://ide.cloud.tencent.com ，用 GitHub 或微信登录。

### 2. 新建工作空间
- 点击「**创建工作空间**」
- **模板**：选择 `Node.js`
- **代码来源**：选择「**导入仓库**」
- **仓库地址**：填入你的 XiviBlog 仓库地址
  ```
  https://github.com/你的用户名/XiviBlog.git
  ```
- 点击「**新建**」

### 3. 等待初始化
工作空间创建完成后，左侧会显示文件树，下方有终端。

---

## 二、一键部署

### 方法 A：使用自动化脚本（推荐）

在 Cloud Studio 终端中执行：

```bash
# 进入项目目录
cd XiviBlog/selfhosted

# 一键部署（会自动安装环境、构建、启动）
bash bootstrap-deploy.sh
```

部署完成后会输出访问地址，例如：
```
访问地址: http://43.143.xx.xx:3000/install
```

### 方法 B：手动部署（如遇问题）

```bash
# 1. 进入项目目录
cd XiviBlog/selfhosted

# 2. 检查 Node.js 版本（需要 >= 18）
node --version

# 3. 安装依赖
npm ci

# 4. 构建项目
npm run build

# 5. 生成配置文件
cp .env.example .env
# 编辑 .env，设置 SESSION_SECRET 和 ADMIN_PASSWORD
# 可以用 openssl rand -hex 32 生成随机密钥

# 6. 初始化数据库
node scripts/install-db.mjs

# 7. 启动服务
npm start
```

---

## 三、完成安装向导

服务启动后：

1. **获取访问地址**
   - Cloud Studio 右侧有「**端口管理**」面板
   - 找到 `3000` 端口，点击「**查看预览**」
   - 或者点击端口旁边的「**映射公网端口**」获取公网地址

2. **打开安装向导**
   ```
   http://your-cloud-studio-url:3000/install
   ```

3. **填写管理员信息**
   - 站点名称：曦微博客
   - 管理员邮箱：你的邮箱
   - 管理员密码：≥6 位

4. **完成安装**
   - 点击「**完成安装**」
   - 系统自动创建数据库和账号

---

## 四、日常维护

### 启动/停止服务
```bash
# 查看状态
pm2 status xiviblog

# 停止
pm2 stop xiviblog

# 启动
pm2 start xiviblog

# 重启
pm2 restart xiviblog
```

### 查看日志
```bash
pm2 logs xiviblog
```

### 更新博客
当 XiviBlog 有新版本时：

```bash
# 进入项目目录
cd /opt/xiviblog/selfhosted

# 拉取最新代码
git pull origin main

# 重新安装依赖并构建
npm ci && npm run build

# 重启服务
pm2 restart xiviblog
```

---

## 五、绑定自定义域名（可选）

Cloud Studio 不支持直接绑定自定义域名到 3000 端口，但可以用 CNAME 转发：

1. 在 Cloud Studio 点击端口映射，获取临时域名（如 `xxxx-3000.cloudstudio.net`）
2. 在你的域名服务商添加 CNAME 记录：
   ```
   blog  →  xxxx-3000.cloudstudio.net
   ```
3. 绑定完成后，通过 `https://blog.yourdomain.com` 访问

---

## 六、常见问题

### Q1：服务自动停止了怎么办？
Cloud Studio 工作空间空闲久了可能休眠。解决方法：
- 登录 Cloud Studio，手动启动服务：
  ```bash
  cd /opt/xiviblog/selfhosted
  pm2 start xiviblog
  ```

### Q2：端口 3000 无法访问？
- 检查服务是否运行：`pm2 status`
- 检查端口映射是否开启：右侧「端口管理」→ 找到 3000 → 点击「开启公网访问」

### Q3：如何设置开机自启？
```bash
pm2 startup systemd
pm2 save
```

### Q4：想换成腾讯云 Lighthouse？
见 [README-install.md](../README-install.md) 方式三，一键部署到 VPS。

---

## 七、对比其他部署方式

| 方式 | 成本 | 维护难度 | 适合场景 |
|------|------|---------|---------|
| Cloud Studio | 免费 | 低 | 个人学习、测试 |
| 腾讯云 Lighthouse | ~99元/年 | 中 | 生产环境 |
| 本地服务器 | 自有硬件 | 高 | 内网使用 |
| Docker | 免费/自有主机 | 中 | 多服务部署 |

---

## 八、相关资源

- XiviBlog GitHub: https://github.com/yangxivi/XiviBlog
- Cloud Studio: https://ide.cloud.tencent.com
- 官方部署文档: [README-install.md](../README-install.md)
