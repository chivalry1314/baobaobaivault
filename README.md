# baobaobaivault

This repository contains the backend, share frontend, and deployment assets for `baobaobaivault`.

## Deployment docs

- [中文部署文档](./README.zh-CN.md)
- [English Deployment Guide](./README.en.md)

## Core deployment files

- [docker-compose.public.yml](./docker-compose.public.yml)
- [.env.public.example](./.env.public.example)
- [deploy/backend/config.public.example.yaml](./deploy/backend/config.public.example.yaml)
- [deploy/nginx/default.public.conf](./deploy/nginx/default.public.conf)
- [.github/workflows/publish-images.yml](./.github/workflows/publish-images.yml)

## Share email verification

- [English Guide](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)
- [中文说明](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)

## Published images

- `ghcr.io/chivalry1314/baobaobaivault-backend`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`
