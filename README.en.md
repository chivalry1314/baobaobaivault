# baobaobaivault Deployment Guide

This document is a complete English deployment guide for running the project on a server with public container images and Docker Compose.

Published images:

- `ghcr.io/chivalry1314/baobaobaivault-backend`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`

Project components:

- `backend`: Go API service
- `sharefrontend`: Next.js share frontend
- `postgres`: primary database
- `redis`: cache and auxiliary runtime store
- `nginx`: public HTTPS entrypoint and reverse proxy

## 1. Recommended Topology

The recommended production layout is a single Linux server running 5 services with `docker compose`:

- `nginx`
- `sharefrontend`
- `backend`
- `postgres`
- `redis`

Recommended traffic flow:

- users only access `https://share.example.com`
- `nginx` exposes `80` and `443`
- `sharefrontend` only listens on the Docker network on `3000`
- `backend` only listens on the Docker network on `8080`
- `postgres` and `redis` are not exposed publicly

Why this layout is recommended:

- the frontend keeps a Next.js rewrite for local/dev use, while production Nginx can proxy `/api/share/*` directly to the backend to reduce one hop
- in backend `release` mode, share auth cookies are marked `Secure`
- production should therefore use HTTPS by default

## 2. Suggested Server Directory Layout

Create the following directory structure on the server:

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

Purpose of each path:

- `docker-compose.yml`: container orchestration file
- `.env`: Compose environment variables
- `backend/config/config.yaml`: backend runtime configuration
- `backend/storage`: backend local uploaded file storage
- `deploy/nginx/default.conf`: Nginx site configuration
- `deploy/nginx/ssl`: Cloudflare origin certificate directory
- `data/postgres`: PostgreSQL persistent data
- `data/redis`: Redis persistent data

## 3. Server Requirements

Recommended baseline:

- Ubuntu 22.04 or 24.04
- Docker Engine
- Docker Compose Plugin
- a domain name pointing to the server
- Cloudflare proxy and HTTPS
- a Cloudflare origin certificate, or another source certificate you already manage

Suggested installation commands:

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

## 4. Files You Need

Copy and rename:

- `docker-compose.public.yml` -> `docker-compose.yml`
- `.env.public.example` -> `.env`
- `deploy/backend/config.public.example.yaml` -> `backend/config/config.yaml`
- `deploy/nginx/default.public.conf` -> `deploy/nginx/default.conf`

## 5. Docker Compose Reference

This is the recommended public deployment file:

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

### `postgres`

- image: `postgres:16-alpine`
- not exposed publicly
- persistent volume: `./data/postgres`
- key variables:
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`

### `redis`

- image: `redis:7-alpine`
- not exposed publicly
- persistent volume: `./data/redis`
- password protection is enabled with `--requirepass`
- key variable:
  - `REDIS_PASSWORD`

### `backend`

- image: `ghcr.io/chivalry1314/baobaobaivault-backend`
- mounted config: `./backend/config/config.yaml:/app/config.yaml:ro`
- mounted storage: `./backend/storage:/app/storage`
- health endpoint: `GET http://127.0.0.1:8080/healthz`

### `sharefrontend`

- image: `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`
- internal port: `3000`
- not exposed directly to the public internet
- this public image is built to talk to the backend at `http://backend:8080`

### `nginx`

- image: `nginx:1.27-alpine`
- public ports:
  - `80`
  - `443`
- certificate mount:
  - `./deploy/nginx/ssl:/etc/nginx/ssl:ro`

### Logging policy

The Compose template enables Docker `json-file` log rotation for every service:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Meaning:

- each log file is capped at `10MB`
- each container keeps up to `5` log files
- the oldest rotated file is deleted when the limit is exceeded

This means:

- logs do not need their own bind-mounted project directory
- logs can be viewed directly with `docker compose logs`
- this is suitable for recent operational troubleshooting
- this is not a long-term audit archive strategy

## 6. `.env` File Reference

Recommended content:

```env
POSTGRES_DB=baobaobaivault
POSTGRES_USER=vaultuser
POSTGRES_PASSWORD=change-this-postgres-password
REDIS_PASSWORD=change-this-redis-password
BACKEND_IMAGE=ghcr.io/chivalry1314/baobaobaivault-backend:latest
SHAREFRONTEND_IMAGE=ghcr.io/chivalry1314/baobaobaivault-sharefrontend:latest
```

Explanation:

- `POSTGRES_DB`: PostgreSQL database name
- `POSTGRES_USER`: PostgreSQL username
- `POSTGRES_PASSWORD`: PostgreSQL password, replace with a strong secret
- `REDIS_PASSWORD`: Redis password, replace with a strong secret
- `BACKEND_IMAGE`: backend image reference, can be pinned to a release tag
- `SHAREFRONTEND_IMAGE`: frontend image reference, can be pinned to a release tag

Recommended practice:

- `latest` is acceptable for quick testing
- production should pin explicit tags such as `:v1.0.0`

## 7. Backend `config.yaml` Full Example

Recommended content:

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

Important notes:

- `server.mode: release`
  - required in production
  - share auth cookies become `Secure`
- `cors.allow_origins`
  - replace with your real frontend domain
- `database.host`
  - must be `postgres` inside Compose
- `redis.host`
  - must be `redis` inside Compose
- `jwt.secret`
  - replace with a strong random secret
- `storage.default_provider: local`
  - stores files in the mounted local volume
- `baidu.redirect_uri`
  - must use the real HTTPS domain if Baidu OAuth is enabled

## 8. Nginx Full Example

Recommended content:

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

Notes:

- replace `server_name` with your real domain
- place your Cloudflare origin certificate under `deploy/nginx/ssl`
- recommended filenames:
  - `deploy/nginx/ssl/fullchain.pem`
  - `deploy/nginx/ssl/privkey.pem`
- the template already enables:
  - `TLSv1.2` and `TLSv1.3`
  - `HSTS`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
- extended proxy timeouts are included for slower requests
- `/nginx-health` can be used as an Nginx health endpoint
- `client_max_body_size 1024m` supports large file uploads
- Nginx should proxy `/api/share` directly to `backend` in production
  - this avoids an extra hop through Next.js for browser API requests
- `sharefrontend` still keeps the rewrite for local/dev and for direct app-to-backend requests inside the container network

## 9. Cloudflare HTTPS Setup

If you use Cloudflare, the recommended SSL mode is:

- `Full (strict)`

Not recommended:

- `Flexible`

Why:

- the backend uses `Secure` cookies in `release` mode
- `Flexible` keeps the Cloudflare-to-origin hop on HTTP
- that is not a good fit for this production deployment

Recommended steps:

1. Enable Cloudflare proxy for your domain
2. Use `Full (strict)` in Cloudflare SSL/TLS settings
3. Create a Cloudflare origin certificate
4. Place the certificate files at:

```text
deploy/nginx/ssl/fullchain.pem
deploy/nginx/ssl/privkey.pem
```

They will be mounted into the container as:

```text
/etc/nginx/ssl/fullchain.pem
/etc/nginx/ssl/privkey.pem
```

## 10. Deployment Steps

Assuming all files are already in `/opt/baobaobaivault`:

```bash
cd /opt/baobaobaivault
docker compose up -d
```

If you want to pull the newest published images first:

```bash
cd /opt/baobaobaivault
docker compose pull
docker compose up -d
```

## 11. Post-Deployment Verification

Check service status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f nginx
docker compose logs -f sharefrontend
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f redis
```

Logging notes:

- view logs from all services:

```bash
docker compose logs -f
```

- view the latest 200 lines from specific services:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 sharefrontend
docker compose logs --tail=200 nginx
```

- inspect the host log file path for a container:

```bash
docker inspect -f '{{.LogPath}}' <container_name>
```

Example:

```bash
docker inspect -f '{{.LogPath}}' baobaobaivault-backend
```

Typical path:

```text
/var/lib/docker/containers/<container-id>/<container-id>-json.log
```

Recommended checks:

- open `https://share.example.com`
- verify that login or share browsing works
- upload a file and confirm that files appear under `backend/storage`
- confirm backend health checks are passing

Manual backend health check:

```bash
docker compose exec backend wget -qO- http://127.0.0.1:8080/healthz
```

## 12. Updates and Rollbacks

Upgrade to newer images:

```bash
docker compose pull
docker compose up -d
```

If you use pinned tags such as:

- `ghcr.io/chivalry1314/baobaobaivault-backend:v1.0.0`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend:v1.0.0`

then rolling back only requires changing the image tags in `.env` and running:

```bash
docker compose up -d
```

## 13. Image Publishing and GHCR

This repository already includes:

- `.github/workflows/publish-images.yml`

It publishes when:

- pushing to `main`
- pushing tags like `v1.0.0`
- manually triggering the workflow

After publishing, check:

- `https://github.com/chivalry1314/baobaobaivault/actions`
- `https://github.com/chivalry1314?tab=packages`

After the first successful publish, set package visibility to `Public` so other users can pull images anonymously.

## 14. Troubleshooting

### 1. The site opens but login fails

Common cause:

- using HTTP instead of HTTPS
- backend is in `release` mode and cookies are marked `Secure`

Fix:

- deploy the site over HTTPS

### 2. The frontend loads but API calls fail

Common cause:

- `backend` is not running
- backend health checks are failing
- image versions are mismatched

Fix:

- check `docker compose ps`
- check `docker compose logs -f backend`

### 3. Uploaded files disappear after container recreation

Common cause:

- `./backend/storage:/app/storage` was not mounted

### 4. The logs are not mapped into a local project directory

This is expected.

The current deployment uses Docker-managed container logs instead of bind-mounting log files into the project directory. The preferred way to inspect them is:

```bash
docker compose logs -f
```

### 5. Can logs still be read if Docker crashes

It depends:

- if the Docker daemon only restarts and the host disk is intact, logs usually remain available
- if the container is removed, Docker data is pruned, or the disk is lost, logs may be gone
- if logs exceed the configured rotation window, the oldest logs are deleted automatically

So this setup is good for troubleshooting and recent operational logs, but not for long-term archival

### 6. PostgreSQL or Redis connection errors

Common cause:

- `config.yaml` does not use `postgres` and `redis` as hostnames
- secrets do not match `.env`

### 7. Baidu callback failures

Common cause:

- `baidu.redirect_uri` is still pointing to a local address

## 15. Recommended Production Practices

- pin version tags instead of relying on `latest`
- back up:
  - `data/postgres`
  - `backend/storage`
  - `deploy/nginx/ssl`
- use strong secrets in `.env` and `config.yaml`
- clean up unused image versions regularly
- validate in staging before upgrading production

## 16. Related Files

- [README.md](./README.md)
- [README.zh-CN.md](./README.zh-CN.md)
- [docker-compose.public.yml](./docker-compose.public.yml)
- [.env.public.example](./.env.public.example)
- [deploy/backend/config.public.example.yaml](./deploy/backend/config.public.example.yaml)
- [deploy/nginx/default.public.conf](./deploy/nginx/default.public.conf)
- [.github/workflows/publish-images.yml](./.github/workflows/publish-images.yml)
- [Share Auth Email Verification Guide](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)
- [Share Auth Email Verification Guide (Chinese)](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)
