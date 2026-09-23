## v1.3.18

### 修复
- 系统更新页面：版本号重复 v 前缀（vv1.3.17 → v1.3.17）
- 系统更新页面：导航菜单图标缺失
- 在线更新逻辑：优先使用 Release zip 包（完整代码），fallback 到 GitHub tarball
- 上传安装包验证：兼容 XiviBlog-vX.Y.Z-selfhosted.zip 命名格式

### 变更
- selfhosted/lib/version.ts 版本号：1.3.17 → 1.3.18
