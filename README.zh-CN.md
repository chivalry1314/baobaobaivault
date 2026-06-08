# baobaobaivault 部署说明

本文是一份面向服务器部署的完整中文方案，基于本仓库已经准备好的公共镜像发布与 Docker Compose 模板。

当前公共镜像地址：

- `ghcr.io/chivalry1314/baobaobaivault-backend`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`

项目组成：

- `backend`：Go API 服务
- `sharefrontend`：Next.js 分享前端
- `postgres`：业务数据库
- `redis`：缓存和会话辅助服务
- `nginx`：对外 HTTPS 入口和反向代理

## 1. 推荐部署拓扑

推荐使用一台 Linux 服务器，通过 `docker compose` 启动 5 个服务：

- `nginx`
- `sharefrontend`
- `backend`
- `postgres`
- `redis`

访问路径建议：

- 用户只访问 `https://share.example.com`
- `nginx` 对外暴露 `80` 和 `443`
- `sharefrontend` 只在 Docker 内网监听 `3000`
- `backend` 只在 Docker 内网监听 `8080`
- `postgres` 和 `redis` 不对公网暴露

推荐原因：

- 前端会保留 Next.js rewrite 以兼容本地开发，但生产环境建议由 Nginx 直接反代 `/api/share/*` 到后端，减少一跳转发
- 后端 `release` 模式下分享登录 Cookie 会带 `Secure`
- 因此生产环境应该默认启用 HTTPS

## 2. 服务器目录规划

建议在服务器上建立如下目录：

```text
/opt/baobaobaivault/
  docker-compose.yml
  .env
  backend/
    config/
      config.yaml
    storage/
  deploy/
    nginx/
      default.conf
      ssl/
        fullchain.pem
        privkey.pem
  data/
    postgres/
    redis/
```

各目录用途：

- `docker-compose.yml`：容器编排配置
- `.env`：Compose 使用的环境变量
- `backend/config/config.yaml`：后端运行配置
- `backend/storage`：后端本地上传文件持久化目录
- `deploy/nginx/default.conf`：Nginx 站点配置
- `deploy/nginx/ssl`：Cloudflare 源站证书目录
- `data/postgres`：PostgreSQL 数据持久化
- `data/redis`：Redis 数据持久化

## 3. 服务器基础要求

推荐环境：

- Ubuntu 22.04 或 24.04
- Docker Engine
- Docker Compose Plugin
- 已解析到服务器公网 IP 的域名
- Cloudflare 代理与 HTTPS
- Cloudflare 源站证书，或其他你已准备好的源站证书

建议安装命令：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo mkdir -p /opt/baobaobaivault/deploy/backend
sudo mkdir -p /opt/baobaobaivault/deploy/nginx
sudo mkdir -p /opt/baobaobaivault/deploy/nginx/ssl
sudo mkdir -p /opt/baobaobaivault/data/postgres
sudo mkdir -p /opt/baobaobaivault/data/redis
sudo mkdir -p /opt/baobaobaivault/data/storage
```

## 4. 需要准备的文件

从仓库复制并重命名：

- `docker-compose.public.yml` -> `docker-compose.yml`
- `.env.public.example` -> `.env`
- `deploy/backend/config.public.example.yaml` -> `backend/config/config.yaml`
- `deploy/nginx/default.public.conf` -> `deploy/nginx/default.conf`

## 5. Docker Compose 详解

下面这份 Compose 文件就是对外推荐模板：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-baobaobaivault}
      POSTGRES_USER: ${POSTGRES_USER:-vaultuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-vaultuser} -d ${POSTGRES_DB:-baobaobaivault}"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - vault-net

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:?set REDIS_PASSWORD in .env}"]
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - vault-net

  backend:
    image: ${BACKEND_IMAGE:-ghcr.io/chivalry1314/baobaobaivault-backend:latest}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/config/config.yaml:/app/config.yaml:ro
      - ./backend/storage:/app/storage
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
      interval: 15s
      timeout: 5s
      retries: 10
    networks:
      - vault-net

  sharefrontend:
    image: ${SHAREFRONTEND_IMAGE:-ghcr.io/chivalry1314/baobaobaivault-sharefrontend:latest}
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - vault-net

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      - sharefrontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./deploy/nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - vault-net

networks:
  vault-net:
    driver: bridge
```

### `postgres` 服务说明

- 镜像：`postgres:16-alpine`
- 端口：不对外暴露，仅供 `backend` 使用
- 持久化目录：`./data/postgres`
- 关键变量：
  - `POSTGRES_DB`：数据库名
  - `POSTGRES_USER`：数据库用户名
  - `POSTGRES_PASSWORD`：数据库密码

### `redis` 服务说明

- 镜像：`redis:7-alpine`
- 端口：不对外暴露，仅供 `backend` 使用
- 持久化目录：`./data/redis`
- 启动命令中使用 `--requirepass` 启用密码保护
- 关键变量：
  - `REDIS_PASSWORD`

### `backend` 服务说明

- 镜像：`ghcr.io/chivalry1314/baobaobaivault-backend`
- 配置文件挂载：`./backend/config/config.yaml:/app/config.yaml:ro`
- 文件存储挂载：`./backend/storage:/app/storage`
- 健康检查：`GET http://127.0.0.1:8080/healthz`

### `sharefrontend` 服务说明

- 镜像：`ghcr.io/chivalry1314/baobaobaivault-sharefrontend`
- 容器内监听端口：`3000`
- 不对公网直接暴露，由 `nginx` 转发
- 这个公共镜像在构建时已经固定使用 `http://backend:8080` 作为后端地址

### `nginx` 服务说明

- 镜像：`nginx:1.27-alpine`
- 对外暴露：
  - `80`
  - `443`
- 证书目录挂载：
  - `./deploy/nginx/ssl:/etc/nginx/ssl:ro`

### 日志策略说明

当前 Compose 模板为所有服务启用了 Docker `json-file` 日志轮转：

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

含义：

- 单个日志文件最大 `10MB`
- 每个容器最多保留 `5` 份日志文件
- 超出上限后，最老的日志文件会被自动删除

这意味着：

- 日志不需要通过 `volumes` 单独映射到项目目录
- 可以直接通过 `docker compose logs` 查看
- 适合近期排障
- 不适合长期审计归档

## 6. `.env` 文件详解

推荐内容如下：

```env
POSTGRES_DB=baobaobaivault
POSTGRES_USER=vaultuser
POSTGRES_PASSWORD=change-this-postgres-password
REDIS_PASSWORD=change-this-redis-password
BACKEND_IMAGE=ghcr.io/chivalry1314/baobaobaivault-backend:latest
SHAREFRONTEND_IMAGE=ghcr.io/chivalry1314/baobaobaivault-sharefrontend:latest
```

说明：

- `POSTGRES_DB`：PostgreSQL 数据库名
- `POSTGRES_USER`：PostgreSQL 用户名
- `POSTGRES_PASSWORD`：PostgreSQL 密码，必须改成强密码
- `REDIS_PASSWORD`：Redis 密码，必须改成强密码
- `BACKEND_IMAGE`：后端镜像地址，可以改成固定版本 tag
- `SHAREFRONTEND_IMAGE`：前端镜像地址，可以改成固定版本 tag

推荐做法：

- 测试环境可以先用 `latest`
- 生产环境建议锁定版本，比如 `:v1.0.0`

## 7. 后端 `config.yaml` 完整示例与说明

推荐内容如下：

```yaml
server:
  port: "8080"
  read_timeout: 30
  write_timeout: 30
  mode: release
  allow_public_bootstrap: false
  auto_bootstrap_admin: false
  admin_email: ""
  admin_password: ""
  admin_username: "admin"
  admin_nickname: "Administrator"

cors:
  enabled: true
  allow_origins:
    - "https://share.example.com"
  allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  allow_headers: ["Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"]
  expose_headers: ["Content-Disposition", "Content-Length", "ETag"]
  allow_credentials: true
  max_age: 86400

database:
  host: "postgres"
  port: 5432
  user: "vaultuser"
  password: "change-this-postgres-password"
  dbname: "baobaobaivault"
  sslmode: "disable"
  max_open_conns: 20
  max_idle_conns: 5
  conn_max_lifetime: 3600

redis:
  host: "redis"
  port: 6379
  password: "change-this-redis-password"
  db: 0

jwt:
  secret: "change-this-jwt-secret"
  expire_time: 24h
  issuer: "baobaobaivault"

storage:
  default_provider: "local"
  temp_dir: "/tmp/baobaobaivault"
  max_file_size: 10737418240

baidu:
  enabled: false
  api_key: ""
  secret_key: ""
  redirect_uri: "https://share.example.com/api/v1/connectors/baidu/callback"
  scope: "basic,netdisk"
  auth_url: "https://openapi.baidu.com/oauth/2.0/authorize"
  auth_extra_params: {}
  token_url: "https://openapi.baidu.com/oauth/2.0/token"
  pan_api_base_url: "https://pan.baidu.com/rest/2.0"
  pan_upload_url: "https://d.pcs.baidu.com/rest/2.0/pcs/superfile2"
  default_path_prefix: "/apps/baobaobaiphone/backups"
  state_secret: "change-this-state-secret"
  token_encrypt_secret: "change-this-token-encrypt-secret"
  http_timeout_seconds: 30

webpush:
  enabled: false
  public_api_enabled: false
  vapid_subject: "mailto:admin@example.com"
  vapid_public_key: ""
  vapid_private_key: ""
  allow_vapid_auto_generate: false
  default_ttl_seconds: 300
  dispatch_api_key: ""
  queue_concurrency: 20
  queue_buffer: 1000
  push_proxy_url: ""

log:
  level: "info"
  format: "json"
```

重点说明：

- `server.mode: release`
  - 生产环境必须使用
  - 会让分享登录 Cookie 带 `Secure`
- `cors.allow_origins`
  - 改成你的正式前端域名
- `database.host`
  - 在 Compose 内必须写成 `postgres`
- `redis.host`
  - 在 Compose 内必须写成 `redis`
- `jwt.secret`
  - 必须改成高强度随机字符串
- `storage.default_provider: local`
  - 表示文件存储在本地挂载卷中
- `baidu.redirect_uri`
  - 如果启用百度网盘 OAuth，必须换成正式 HTTPS 域名

## 8. Nginx 配置完整示例与说明

推荐内容如下：

```nginx
server {
    listen 80;
    server_name share.example.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name share.example.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 1024m;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        application/rss+xml
        image/svg+xml;

    location /_next/static/ {
        proxy_pass http://sharefrontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location /api/share/ {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://sharefrontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /nginx-health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "healthy\n";
    }
}
```

说明：

- `server_name` 要改成你的正式域名
- Cloudflare 源站证书放在 `deploy/nginx/ssl`
- 建议文件名固定为：
  - `deploy/nginx/ssl/fullchain.pem`
  - `deploy/nginx/ssl/privkey.pem`
- 模板中已经启用：
  - `TLSv1.2` 和 `TLSv1.3`
  - `HSTS`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
- 已配置较长的代理超时，适合较慢请求
- `/nginx-health` 可用于 Nginx 自身健康检查
- `client_max_body_size 1024m` 用于支持较大文件上传
- 生产环境建议让 Nginx 直接反代 `/api/share` 到 `backend`
  - 这样浏览器发起的 API 请求不会再额外绕过一次 Next.js
- `sharefrontend` 仍然保留 rewrite
  - 便于本地开发，也兼容容器内的前端到后端调用

## 9. Cloudflare HTTPS 配置

如果你使用 Cloudflare，推荐模式是：

- `Full (strict)`

不推荐：

- `Flexible`

原因：

- 当前项目在后端 `release` 模式下会使用 `Secure` Cookie
- `Flexible` 是 Cloudflare 到源站仍然使用 HTTP
- 这不适合当前生产部署

推荐做法：

1. 在 Cloudflare 中为你的域名开启代理
2. 在 SSL/TLS 设置中使用 `Full (strict)`
3. 在 Cloudflare 中申请源站证书
4. 将证书文件放到：

```text
deploy/nginx/ssl/fullchain.pem
deploy/nginx/ssl/privkey.pem
```

然后通过 Compose 挂载到容器中的：

```text
/etc/nginx/ssl/fullchain.pem
/etc/nginx/ssl/privkey.pem
```

## 10. 部署步骤

假设你已经把文件放到 `/opt/baobaobaivault`：

```bash
cd /opt/baobaobaivault
docker compose up -d
```

如果需要拉取最新镜像再启动：

```bash
cd /opt/baobaobaivault
docker compose pull
docker compose up -d
```

## 11. 启动后验证

查看服务状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f nginx
docker compose logs -f sharefrontend
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f redis
```

日志查看说明：

- 查看全部服务日志：

```bash
docker compose logs -f
```

- 查看单个服务最近 200 行：

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 sharefrontend
docker compose logs --tail=200 nginx
```

- 查看日志对应的宿主机文件路径：

```bash
docker inspect -f '{{.LogPath}}' <container_name>
```

例如：

```bash
docker inspect -f '{{.LogPath}}' baobaobaivault-backend
```

常见路径类似：

```text
/var/lib/docker/containers/<container-id>/<container-id>-json.log
```

建议检查：

- `https://share.example.com` 能否打开
- 前端页面能否正常登录或浏览分享卡片
- 上传文件后 `backend/storage` 中是否出现文件
- 后端健康检查是否正常

如果要手动检查后端健康：

```bash
docker compose exec backend wget -qO- http://127.0.0.1:8080/healthz
```

## 12. 更新与回滚

更新到新镜像：

```bash
docker compose pull
docker compose up -d
```

如果你使用固定版本标签，比如：

- `ghcr.io/chivalry1314/baobaobaivault-backend:v1.0.0`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend:v1.0.0`

那么回滚时只需要把 `.env` 里的镜像 tag 改回旧版本，再执行：

```bash
docker compose up -d
```

## 13. 镜像发布与 GHCR

本仓库已提供工作流：

- `.github/workflows/publish-images.yml`

触发方式：

- 推送到 `main`
- 推送 tag，例如 `v1.0.0`
- 手动执行工作流

镜像成功发布后，可以在这里查看：

- `https://github.com/chivalry1314/baobaobaivault/actions`
- `https://github.com/chivalry1314?tab=packages`

第一次发布后，建议把包可见性改成 `Public`，这样其他人才能匿名拉取镜像。

## 14. 常见问题

### 1. 页面能打开，但登录失败

常见原因：

- 使用了 HTTP 而不是 HTTPS
- `server.mode` 已经是 `release`，Cookie 被标记为 `Secure`

解决方式：

- 使用 HTTPS 部署

### 2. 前端能打开，但 API 不通

常见原因：

- `backend` 容器未启动
- `backend` 健康检查失败
- `sharefrontend` 镜像版本不匹配

解决方式：

- 查看 `docker compose ps`
- 查看 `docker compose logs -f backend`

### 3. 上传文件后重启容器文件丢失

常见原因：

- 没有挂载 `./backend/storage:/app/storage`

### 4. 日志文件没有映射到本地目录，是否正常

是正常的。

当前方案使用 Docker 自己的日志驱动保存日志，而不是把日志文件挂载到项目目录中。查看方式应该优先使用：

```bash
docker compose logs -f
```

### 5. Docker 挂了之后日志还能不能看

分情况：

- 如果只是 Docker 服务临时重启，但宿主机磁盘还在，日志通常还在
- 如果容器被删除、Docker 数据目录被清理、机器磁盘损坏，日志可能丢失
- 如果日志超过轮转保留上限，最老日志会被自动删除

所以当前方案适合运行日志与排障，不适合作为长期归档方案

### 6. PostgreSQL 或 Redis 连不上

常见原因：

- `config.yaml` 中主机名不是 `postgres` 和 `redis`
- 密码与 `.env` 不一致

### 7. 百度网盘回调失败

常见原因：

- `baidu.redirect_uri` 仍然是本地地址

## 15. 推荐的生产实践

- 使用固定版本 tag，不要长期依赖 `latest`
- 定期备份：
  - `data/postgres`
  - `backend/storage`
  - `deploy/nginx/ssl`
- 为 `.env` 和 `config.yaml` 使用强密码和随机密钥
- 定期清理不用的镜像版本
- 先在测试环境验证，再升级生产环境

## 16. 相关文件

- [README.md](./README.md)
- [README.en.md](./README.en.md)
- [docker-compose.public.yml](./docker-compose.public.yml)
- [.env.public.example](./.env.public.example)
- [deploy/backend/config.public.example.yaml](./deploy/backend/config.public.example.yaml)
- [Share 邮箱验证码部署说明（中文）](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)
- [Share Email Verification Guide (English)](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)
- [deploy/nginx/default.public.conf](./deploy/nginx/default.public.conf)
- [.github/workflows/publish-images.yml](./.github/workflows/publish-images.yml)
