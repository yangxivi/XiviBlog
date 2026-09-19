# v1.3.4

## 新增

- 后台新增「上传安装包更新」功能：支持手动上传 xiviblog-selfhosted-vX.Y.Z.zip 进行更新
- 上传前自动备份数据与源码，失败可回滚
- 更新检测失败时提示使用上传方式作为备选方案

## 变更

- selfhosted/lib/version.ts 版本号：1.3.3 → 1.3.4
- selfhosted/app/api/admin/update/upload/route.ts 新增上传更新 API
- selfhosted/app/admin/settings/update-panel.tsx 新增上传 UI
