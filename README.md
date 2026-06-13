# baobaobaivault

`baobaobaivault` contains the backend service, the `sharefrontend` web app, and the deployment assets used to run the system in production.

## Recommended Architecture

- Primary frontend: `sharefrontend`
- Primary API path: `/api/share/*`
- Recommended deployment model: `sharefrontend + backend + postgres + redis + nginx`
- Recommended production entrypoint: `https://your-domain`

## Documentation Index

### Deployment

- [中文部署文档](./README.zh-CN.md)
- [English Deployment Guide](./README.en.md)
- [最小生产配置清单](./DEPLOY_CHECKLIST.zh-CN.md)
- [Minimal Production Checklist](./DEPLOY_CHECKLIST.en.md)

### Backend Config

- [Backend Config Overview](./backend/config/README.md)
- [Local Config Template](./backend/config/config.example.yaml)
- [Public Deployment Config Template](./deploy/backend/config.public.example.yaml)

### Share Auth Email Verification

- [中文说明](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)
- [English Guide](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)

### Share Media Storage to OSS

- [Share 媒体文件切换到 OSS 指南](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md)
- [Share Media Storage to OSS Guide](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY.md)
- [存储到媒体上传操作手册](./STORAGE_WORKFLOW.zh-CN.md)
- [Storage to Media Upload Workflow](./STORAGE_WORKFLOW.en.md)

## Core Deployment Files

- [docker-compose.public.yml](./docker-compose.public.yml)
- [.env.public.example](./.env.public.example)
- [deploy/backend/config.public.example.yaml](./deploy/backend/config.public.example.yaml)
- [deploy/nginx/default.public.conf](./deploy/nginx/default.public.conf)
- [scripts/init-production.sh](./scripts/init-production.sh)
- [.github/workflows/publish-images.yml](./.github/workflows/publish-images.yml)

## Published Images

- `ghcr.io/chivalry1314/baobaobaivault-backend`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`

## Quick Start

1. Read one deployment guide first:
   - Chinese: `README.zh-CN.md`
   - English: `README.en.md`
2. Run the production bootstrap script:
   - `./scripts/init-production.sh`
3. Or copy the public deployment templates manually:
   - `docker-compose.public.yml`
   - `.env.public.example`
   - `deploy/backend/config.public.example.yaml`
   - `deploy/nginx/default.public.conf`
   and fill in your real domain, database password, Redis password, JWT secret, and admin email.
4. Start the stack with `docker compose up -d`.
5. If you want email verification or OSS media storage, continue with the dedicated guides above.
