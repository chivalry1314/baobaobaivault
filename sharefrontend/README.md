# ShareFrontend

`sharefrontend` 是平台版卡片分享前端，基于 Next.js。

普通用户使用平台账号登录后，可以：

- 浏览公开卡片
- 进入创作中心上传卡片
- 管理自己的卡片
- 打开卡片详情页并下载文件

这套前端已经去掉店铺和租户输入，不再使用旧的店铺版路由。

## 当前路由

- `/`：平台首页
- `/login`：普通用户登录/注册
- `/discover`：公开卡片发现页
- `/creator`：创作中心
- `/cards/{cardId}`：卡片详情页

## 架构说明

- 浏览器访问的是 `sharefrontend`
- `sharefrontend` 通过 Next.js rewrite 把 `/api/share/*` 转发给后端
- 后端平台分享接口统一挂在 `/api/share/*`
- 普通用户会话 Cookie 也走 `/api/share/*`

当前 rewrite 配置见 [next.config.ts](./next.config.ts)，后端地址由 `SHARE_BACKEND_ORIGIN` 控制。

## 部署前提

部署 `sharefrontend` 前，需要先把后端服务准备好：

1. PostgreSQL 可用
2. Redis 可用
3. `backend` 已正确加载 `config.yaml`
4. `backend` 已启动并可访问
5. `backend` 运行目录对 `storage/share/files` 有写权限

后端启动时会自动执行数据库迁移，见：

- [backend/cmd/server/main.go](../backend/cmd/server/main.go)
- [backend/internal/config/config.go](../backend/internal/config/config.go)
- [backend/config/config.example.yaml](../backend/config/config.example.yaml)

## 后端部署

### 1. 准备配置文件

复制：

```bash
cp backend/config/config.example.yaml backend/config/config.yaml
```

至少需要确认这些配置：

- `server.port`
- `server.mode`
- `database.host`
- `database.port`
- `database.user`
- `database.password`
- `database.dbname`
- `redis.host`
- `redis.port`
- `jwt.secret`

生产环境建议：

- `server.mode: release`
- `jwt.secret` 使用强随机值
- 数据库和 Redis 使用正式实例
- 前端通过 HTTPS 对外提供服务

说明：

- 后端会在启动时自动执行 `AutoMigrate`
- 平台分享相关表包括：
  - `share_external_users`
  - `share_platform_cards`
  - `share_platform_download_logs`

### 2. 启动后端

在 `backend` 目录执行：

```bash
go run ./cmd/server
```

如果需要构建二进制：

```bash
go build -o bin/server ./cmd/server
./bin/server
```

后端健康检查：

```text
GET http://127.0.0.1:8080/healthz
```

## 前端部署

### 环境要求

- Node.js 20+
- npm

### 1. 安装依赖

在 `sharefrontend` 目录执行：

```bash
npm ci
```

### 2. 配置环境变量

复制：

```bash
cp .env.example .env.local
```

当前只需要一个环境变量：

```env
SHARE_BACKEND_ORIGIN=http://127.0.0.1:8080
```

含义：

- 这是 Next.js 服务端转发时访问的后端地址
- 这个地址应该是 `sharefrontend` 所在服务器能访问到的后端地址
- 浏览器不会直接访问这个地址，而是访问前端自己的 `/api/share/*`

### 3. 本地开发启动

```bash
npm run dev
```

默认访问：

```text
http://127.0.0.1:3000
```

### 4. 生产构建与启动

```bash
npm run build
npm run start
```

如果需要指定监听地址和端口：

```bash
npm run start -- --hostname 0.0.0.0 --port 3000
```

## 生产部署建议

### 推荐拓扑

- 对外暴露 `sharefrontend`
- `sharefrontend` 内部转发到 `backend`
- 数据库和 Redis 只给后端访问

### Nginx / 网关建议

- 用户只访问前端域名，例如 `https://share.example.com`
- 前端 Node 服务监听内网端口，例如 `3000`
- 后端 Go 服务监听内网端口，例如 `8080`
- 由 `sharefrontend` 继续转发 `/api/share/*` 到后端

### 注意事项

- 不要把这套前端当静态站点导出；它依赖 Next.js 服务端 rewrite
- 生产环境如果后端是 `release` 模式，分享登录 Cookie 会带 `Secure`
- 这意味着生产环境应使用 HTTPS
- 后端上传文件落盘到相对目录 `storage/share/files`，需要持久化存储和写权限

## 普通用户怎么使用

### 登录与注册

1. 打开首页 `/`
2. 点击右上角“登录”，进入 `/login`
3. 普通用户可以直接注册平台账号
4. 注册成功后自动进入 `/creator`

### 浏览公开卡片

1. 打开 `/discover`
2. 查看所有公开且已发布的卡片
3. 点击某张卡片进入详情页 `/cards/{cardId}`
4. 在详情页下载文件

### 创作和发布

1. 登录后进入 `/creator`
2. 上传文件
3. 填写标题和描述
4. 选择可见性：
   - `public`：公开，会进入发现页
   - `private`：仅自己可见
5. 发布后即可在个人卡片列表中管理

### 管理卡片

在 `/creator` 中，用户可以：

- 查看自己的卡片列表
- 编辑标题、描述、可见性、状态
- 下载自己的卡片
- 删除自己的卡片

### 预览说明

- 图片文件支持预览
- 非图片文件不能预览，但可以下载

## 联调检查清单

如果页面打不开、登录失败、上传失败，优先检查：

1. 后端是否已启动
2. `SHARE_BACKEND_ORIGIN` 是否正确
3. 后端 `config.yaml` 是否正确加载
4. PostgreSQL 和 Redis 是否连通
5. 后端运行目录是否能写入 `storage/share/files`
6. 前端是否通过自身域名访问 `/api/share/*`

## 验证命令

前端：

```bash
npm run build
```

后端：

```bash
go test ./...
```
