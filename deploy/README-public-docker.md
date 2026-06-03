# Public Docker Deployment

This repository can publish public images for:

- `ghcr.io/chivalry1314/baobaobaivault-backend`
- `ghcr.io/chivalry1314/baobaobaivault-sharefrontend`

Recommended deployment layout on a server:

```text
/opt/baobaobaivault/
  docker-compose.yml
  .env
  deploy/
    backend/
      config.yaml
    nginx/
      default.conf
  data/
    postgres/
    redis/
    storage/
```

## 1. Prepare files

Copy:

- `docker-compose.public.yml` -> `docker-compose.yml`
- `.env.public.example` -> `.env`
- `deploy/backend/config.public.example.yaml` -> `deploy/backend/config.yaml`
- `deploy/nginx/default.public.conf` -> `deploy/nginx/default.conf`

Then replace:

- `share.example.com`
- all placeholder passwords and secrets
- image names under `BACKEND_IMAGE` and `SHAREFRONTEND_IMAGE`

## 2. Why HTTPS is required

When backend `server.mode` is `release`, share auth cookies are marked `Secure`.
That means the public deployment should terminate TLS and expose the site over HTTPS.

## 3. Start services

```bash
docker compose up -d
```

## 4. Publish images from GitHub Actions

The workflow at `.github/workflows/publish-images.yml` pushes multi-arch images to GHCR on:

- pushes to `main`
- tags like `v1.0.0`
- manual runs

By default it publishes to:

- `ghcr.io/<repo-owner>/baobaobaivault-backend`
- `ghcr.io/<repo-owner>/baobaobaivault-sharefrontend`
