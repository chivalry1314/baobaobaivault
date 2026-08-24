# baobaobaivault

> 面向创作者与分享者的内容卡片平台：从创作、投稿、审核到公开发现，一站式管理你的数字资产。

---

## 项目简介

`baobaobaivault` 是一套面向内容分享与分发场景的开源系统。它围绕**卡片（Card）**这一核心单元，提供创作者后台、公开发现页、投稿审核、访问码分发、对象存储扩展、站点品牌定制等能力，适合用作资源分享站、作品展示站或内部资料库。

项目采用前后端分离架构，后端基于 **Go + Gin + GORM**，前端基于 **Next.js (App Router)**，使用 **PostgreSQL** 作为主数据库、**Redis** 作为缓存与会话存储，并可通过 **Nginx** 统一对外提供 HTTPS 入口。

---

## 核心功能

### 1. 用户体系与权限

- 邮箱注册 / 登录，支持可选的**邮箱验证码**注册流程。
- 密码找回、强制修改密码、账号注销。
- 三种内置角色：
  - ** viewer（浏览者）**：可浏览公开卡片、收藏、下载。
  - **creator（创作者）**：可创建、编辑、管理自己的卡片与访问码。
  - **manager（管理员）**：拥有系统管理权限，可配置站点、审核投稿、管理用户与角色。

### 2. 卡片创作与投稿

- 创作者在**创作中心**创建卡片，填写标题、描述、标签。
- 支持上传**封面图**与多个**附件**（slot 机制）。
- 卡片可设置为**公开 / 私有**，并配置**免费 / 付费**访问模式。
- 投稿后可由管理员在**审核后台**进行通过 / 驳回 / 下架操作。
- 公开后的卡片会出现在**发现广场**，支持按分类筛选。

### 3. 访问码分发

- 创作者可为私有或付费卡片生成**访问码**。
- 访问码支持设置过期时间、使用次数限制。
- 用户通过访问码解锁单张卡片，便于私域分享或限时活动。

### 4. 收藏与下载

- 登录用户可收藏公开卡片，在个人中心查看收藏列表。
- 支持下载卡片封面与附件，后端会记录下载日志。

### 5. 站点品牌与分类

- 管理员可在**系统管理 → 站点品牌**中配置：
  - 站点名称、副标题、描述、页脚文案
  - Logo 图片上传
  - 默认创作者名称与签名
- 在**系统管理 → 分类设置**中启用/禁用发现页的各个分类入口：
  - 系统主题、微信主题、桌面组件、角色设定、世界书、应用等。

### 6. 媒体存储扩展（本地 / OSS）

- 默认使用本地文件系统存储封面与附件。
- 可无缝切换到**对象存储**（阿里云 OSS、AWS S3、MinIO、腾讯云 COS 等）。
- 支持浏览器直传 OSS，后端仅负责签发预签名 URL。
- 切换 OSS 后，历史本地文件可保留“本地回退”读取。
- 通过**存储配置 + 命名空间 + 对象管理**三层模型统一管理文件资产。

### 7. 角色与审计

- **角色权限**：管理员可自定义角色并分配细粒度权限。
- **审计日志**：记录关键系统操作，便于安全合规与问题追踪。

### 8. Web Push（可选）

- 后端可独立暴露兼容 `mimiwebpushserver` 的 Web Push API。
- 支持 VAPID 密钥配置，适用于消息推送场景。

---

## 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│                         用户浏览器                            │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│                         Nginx                               │
│  · 80/443 入口                                               │
│  · 静态资源与前端页面反代到 sharefrontend:3002                │
│  · /api/share/* 直接反代到 backend:8080                       │
└───────────────────────────┬─────────────────────────────────┘
              ┌───────────────┴───────────────┐
              │                               │
┌─────────────▼──────────────┐  ┌─────────────▼──────────────┐
│   sharefrontend            │  │   backend                  │
│   Next.js 分享前端          │  │   Go API 服务               │
└────────────────────────────┘  └────────────┬───────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
┌───────────────────▼─────────┐  ┌────────────▼──────────┐  ┌─────────▼────────┐
│   PostgreSQL               │  │   Redis               │  │  本地 / OSS     │
│   主数据库                  │  │   缓存 / 会话 / 队列    │  │  文件存储        │
└─────────────────────────────┘  └───────────────────────┘  └──────────────────┘
```

---

## 快速开始

项目提供公开容器镜像，推荐使用 Docker Compose 一键部署：

```bash
# 1. 克隆仓库
git clone https://github.com/chivalry1314/baobaobaivault.git
cd baobaobaivault

# 2. 生成生产环境配置
./scripts/init-production.sh

# 3. 按需编辑 backend/config/config.yaml

# 4. 拉取镜像并启动
docker compose pull
docker compose up -d

# 5. 创建初始超级管理员
bash scripts/create-admin.sh
```

详细部署说明、Nginx 配置、HTTPS 配置、常见问题排查请参考：

- [中文部署文档](./docs-site/guide/deploy.md)
- [最小生产配置清单](./DEPLOY_CHECKLIST.zh-CN.md)
- [GitHub Pages 操作文档](https://chivalry1314.github.io/baobaobaivault/guide/operation.html)

---

## 文档索引

### 部署与运维

- [中文部署文档](./README.zh-CN.md)
- [English Deployment Guide](./README.en.md)
- [最小生产配置清单](./DEPLOY_CHECKLIST.zh-CN.md)

### 后端配置专题

- [邮箱验证码部署说明（中文）](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)
- [媒体文件切换到 OSS 指南（中文）](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md)
- [Backend Config Overview](./backend/config/README.md)

### 功能操作手册

- [存储到媒体上传操作手册](./STORAGE_WORKFLOW.zh-CN.md)

---

## 已发布镜像

- 后端：`ghcr.io/chivalry1314/baobaobaivault-backend`
- 前端：`ghcr.io/chivalry1314/baobaobaivault-sharefrontend`

生产环境建议固定版本标签（如 `:v1.0.0`），避免长期依赖 `latest`。

---

## 技术栈

| 层级       | 技术                            |
| ---------- | ------------------------------- |
| 前端       | Next.js 14+ (App Router) / React / TypeScript |
| 后端       | Go / Gin / GORM                 |
| 数据库     | PostgreSQL 16+                  |
| 缓存       | Redis 7+                        |
| 网关       | Nginx                           |
| 容器化     | Docker / Docker Compose         |
| 文档站点   | VitePress（部署在 GitHub Pages）|

---

## 参与与许可

- 源码仓库：[https://github.com/chivalry1314/baobaobaivault](https://github.com/chivalry1314/baobaobaivault)
- 文档站点：[https://chivalry1314.github.io/baobaobaivault](https://chivalry1314.github.io/baobaobaivault)
- 镜像包：[https://github.com/chivalry1314?tab=packages](https://github.com/chivalry1314?tab=packages)

本项目基于 MIT 协议开源。
