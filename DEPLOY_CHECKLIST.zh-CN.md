# 最小生产配置清单

这份清单面向当前推荐架构：

- `sharefrontend`
- `backend`
- `postgres`
- `redis`
- `nginx`
- 可选：邮箱验证
- 可选：OSS 媒体存储

适合在正式上线前逐项勾选。

## 1. 域名与 HTTPS

- [ ] 已准备正式域名，例如 `share.example.com`
- [ ] 域名已解析到服务器公网 IP
- [ ] 已配置 HTTPS
- [ ] 如果使用 Cloudflare，SSL 模式已设置为 `Full (strict)`
- [ ] Nginx 已挂载有效证书：
  - `deploy/nginx/ssl/fullchain.pem`
  - `deploy/nginx/ssl/privkey.pem`

## 2. 服务器基础环境

- [ ] 服务器系统为 Ubuntu 22.04 / 24.04 或其他兼容 Linux
- [ ] 已安装 Docker Engine
- [ ] 已安装 Docker Compose Plugin
- [ ] 服务器磁盘空间足够容纳数据库、上传文件、日志和镜像
- [ ] 已开放 80 / 443 端口

## 3. 目录与部署文件

- [ ] 已准备部署目录，例如 `/opt/baobaobaivault`
- [ ] 已运行 `./scripts/init-production.sh`，或已手动复制并重命名：
  - `docker-compose.public.yml` -> `docker-compose.yml`
  - `.env.public.example` -> `.env`
  - `deploy/backend/config.public.example.yaml` -> `backend/config/config.yaml`
  - `deploy/nginx/default.public.conf` -> `deploy/nginx/default.conf`
- [ ] 已创建持久化目录：
  - `data/postgres`
  - `data/redis`
  - `backend/storage`
  - `deploy/nginx/ssl`

## 4. `.env` 最小必填项

- [ ] `POSTGRES_DB` 已设置
- [ ] `POSTGRES_USER` 已设置
- [ ] `POSTGRES_PASSWORD` 是强随机密码（初始化脚本已自动生成）
- [ ] `REDIS_PASSWORD` 是强随机密码（初始化脚本已自动生成）
- [ ] `BACKEND_IMAGE` 已确认版本
- [ ] `SHAREFRONTEND_IMAGE` 已确认版本

推荐：

- 测试环境可以先用 `latest`
- 生产环境建议固定版本 tag

## 5. `backend/config/config.yaml` 最小必填项

- [ ] `server.mode=release`
- [ ] `server.admin_email` 已设置为系统初始化超级管理员邮箱
- [ ] `cors.allow_origins` 已改为正式前端域名
- [ ] `database.host=postgres`
- [ ] `database.user` / `database.password` / `database.dbname` 已与 `.env` 对齐
- [ ] `redis.host=redis`
- [ ] `redis.password` 已与 `.env` 对齐
- [ ] `jwt.secret` 是强随机密钥（初始化脚本已自动生成）
- [ ] `security.field_encryption_key` 是 32 字节高强度随机密钥（base64 或原始字符串），用于加密存储凭证
- [ ] `log.level` 已确认
- [ ] `log.format=json` 或符合你的运维习惯

## 6. 系统超级管理员

- [ ] `server.admin_email` 对应的邮箱已经明确
- [ ] 已通过 `scripts/create-admin.sh` 或 `server create-admin` 创建初始管理员
- [ ] 准备用这个邮箱登录系统
- [ ] 登录后确认 `/api/share/auth/session` 返回 `role: manager`
- [ ] 前端主菜单中可以看到“系统管理”

## 7. 邮箱验证功能

如果你要启用邮箱验证码注册：

- [ ] `email.enabled=true`
- [ ] `email.from_name` 已设置
- [ ] `email.from_address` 已设置为已验证发信地址
- [ ] `email.smtp_host` 已设置
- [ ] `email.smtp_port` 已设置
- [ ] `email.smtp_username` 已设置
- [ ] `email.smtp_password` 已设置
- [ ] 已在系统管理页面测试 SMTP 发信成功
- [ ] 已在“系统管理 -> 认证设置”里开启邮箱验证

如果暂时不启用：

- [ ] `share_auth.email_verification_enabled=false`

参考文档：

- [邮箱验证中文说明](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)
- [Email Verification Guide](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)

## 8. OSS / 对象存储媒体切换

如果你要把卡片封面和附件切到对象存储：

- [ ] 已在“系统管理 -> 存储配置”中创建对象存储配置
- [ ] 已在“系统管理 -> 命名空间”中创建命名空间
- [ ] 已在“系统管理 -> 媒体存储”中选择：
  - 封面命名空间
  - 附件命名空间
- [ ] 已把“存储模式”切到 `object_storage`
- [ ] 切换初期已保持“本地回退读取”为开启
- [ ] 后端本地存储卷暂时没有删除

如果暂时还不切：

- [ ] “存储模式”保持 `local`

参考文档：

- [Share 媒体文件切换到 OSS 指南](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md)
- [Share Media Storage to OSS Guide](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY.md)

## 9. 启动前最终检查

- [ ] Nginx 配置中的 `server_name` 已改成正式域名
- [ ] 反向代理 `/api/share/` 指向 `backend:8080`
- [ ] `.env` 和 `config.yaml` 中没有占位密码残留
- [ ] 持久化卷挂载路径正确
- [ ] 镜像 tag 已确认

## 10. 启动命令

- [ ] 已执行：

```bash
docker compose pull
docker compose up -d
```

- [ ] `docker compose ps` 中所有核心服务均正常：
  - `nginx`
  - `sharefrontend`
  - `backend`
  - `postgres`
  - `redis`

## 11. 上线后验证

- [ ] 首页可以正常打开
- [ ] 注册 / 登录正常
- [ ] 系统管理页可访问
- [ ] 新建卡片正常
- [ ] 卡片详情页正常
- [ ] 附件下载正常
- [ ] 邮箱验证功能符合预期
- [ ] OSS 模式下新上传文件可正常预览和下载
- [ ] 切换前的历史本地文件仍然可读

## 12. 建议保留的运维动作

- [ ] 定期备份：
  - `data/postgres`
  - `backend/storage`
  - `deploy/nginx/ssl`
- [ ] 定期检查磁盘占用
- [ ] 定期清理旧镜像
- [ ] 升级前先在测试环境验证

## 13. 推荐文档入口

- [中文部署文档](./README.zh-CN.md)
- [English Deployment Guide](./README.en.md)
- [Backend Config Overview](./backend/config/README.md)
