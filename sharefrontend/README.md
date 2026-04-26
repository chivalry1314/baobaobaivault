# ShareFrontend

店铺化多租户前端（Next.js）。

## 路由

- `/`：输入租户编码跳转
- `/shop/{tenantCode}`：店铺公开卡片页 + 下载码兑换
- `/shop/{tenantCode}/creator`：创作者后台（租户内注册/登录、卡片管理）

## 本地开发

1. 安装依赖

```bash
npm ci
```

2. 配置环境变量（可选）

```bash
cp .env.example .env.local
```

默认会把 `/api/share/*` 代理到 `http://127.0.0.1:8080`。

说明：
- 前端不做系统初始化，也不创建默认账号。
- 启动前需要后端已存在对应租户（shop）；creator 账号可在 `/shop/{tenantCode}/creator` 内公开注册。

3. 启动

```bash
npm run dev
```

## 说明

前端不再包含 Next 内置 API 路由，全部调用 `baobaobaivault/backend` 的 Share API。
