# baobaobaivault

`baobaobaivault` contains:

- `backend`: Go API service
- `sharefrontend`: Next.js share frontend

## Public Images

This repository publishes public container images to GHCR:

- `ghcr.io/chivalry1314/baobaobaivault-backend`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`

## Quick Deploy

For public image deployment with Docker Compose, see:

- [deploy/README-public-docker.md](/e:/baobaobaiphone/baobaobaivault/deploy/README-public-docker.md:1)

The deployment template files are:

- [docker-compose.public.yml](/e:/baobaobaiphone/baobaobaivault/docker-compose.public.yml:1)
- [.env.public.example](/e:/baobaobaiphone/baobaobaivault/.env.public.example:1)
- [deploy/backend/config.public.example.yaml](/e:/baobaobaiphone/baobaobaivault/deploy/backend/config.public.example.yaml:1)
- [deploy/nginx/default.public.conf](/e:/baobaobaiphone/baobaobaivault/deploy/nginx/default.public.conf:1)

## Minimal Server Flow

1. Copy the template files to your server.
2. Update the domain, passwords, and secrets.
3. Prepare HTTPS certificates for your domain.
4. Start services with `docker compose up -d`.

## Image Publishing

GitHub Actions can publish multi-arch images to GHCR through:

- [.github/workflows/publish-images.yml](/e:/baobaobaiphone/baobaobaivault/.github/workflows/publish-images.yml:1)

The workflow publishes on:

- push to `main`
- tags like `v1.0.0`
- manual trigger
