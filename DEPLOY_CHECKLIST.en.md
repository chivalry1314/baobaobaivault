# Minimal Production Checklist

This checklist is for the current recommended production stack:

- `sharefrontend`
- `backend`
- `postgres`
- `redis`
- `nginx`
- optional email verification
- optional OSS media storage

Use it as a final pre-launch checklist.

## 1. Domain and HTTPS

- [ ] A real domain is ready, such as `share.example.com`
- [ ] The domain points to the server public IP
- [ ] HTTPS is configured
- [ ] If using Cloudflare, SSL mode is set to `Full (strict)`
- [ ] Valid certificates are mounted for Nginx:
  - `deploy/nginx/ssl/fullchain.pem`
  - `deploy/nginx/ssl/privkey.pem`

## 2. Base Server Environment

- [ ] The server runs Ubuntu 22.04 / 24.04 or another compatible Linux distribution
- [ ] Docker Engine is installed
- [ ] Docker Compose Plugin is installed
- [ ] Disk space is sufficient for database, uploads, logs, and images
- [ ] Ports 80 and 443 are open

## 3. Directories and Deployment Files

- [ ] A deployment directory exists, such as `/opt/baobaobaivault`
- [ ] The following files were copied and renamed:
  - `docker-compose.public.yml` -> `docker-compose.yml`
  - `.env.public.example` -> `.env`
  - `deploy/backend/config.public.example.yaml` -> `backend/config/config.yaml`
  - `deploy/nginx/default.public.conf` -> `deploy/nginx/default.conf`
- [ ] Persistent directories exist:
  - `data/postgres`
  - `data/redis`
  - `backend/storage`
  - `deploy/nginx/ssl`

## 4. Minimum `.env` Values

- [ ] `POSTGRES_DB` is set
- [ ] `POSTGRES_USER` is set
- [ ] `POSTGRES_PASSWORD` has been replaced with a strong secret
- [ ] `REDIS_PASSWORD` has been replaced with a strong secret
- [ ] `BACKEND_IMAGE` version is confirmed
- [ ] `SHAREFRONTEND_IMAGE` version is confirmed

Recommended:

- `latest` is acceptable for testing
- production should pin explicit tags

## 5. Minimum `backend/config/config.yaml` Values

- [ ] `server.mode=release`
- [ ] `server.admin_email` is set to the initial super admin email
- [ ] `cors.allow_origins` matches the real frontend domain
- [ ] `database.host=postgres`
- [ ] `database.user` / `database.password` / `database.dbname` match `.env`
- [ ] `redis.host=redis`
- [ ] `redis.password` matches `.env`
- [ ] `jwt.secret` has been replaced with a strong random secret
- [ ] `log.level` is confirmed
- [ ] `log.format=json` or another value that matches your ops model

## 6. System Super Admin

- [ ] The `server.admin_email` target account is clearly chosen
- [ ] You are ready to register or sign in with this email
- [ ] After login, `/api/share/auth/session` shows:
  - `role: manager`
  - `isConfiguredSuperAdmin: true`
- [ ] The main frontend menu shows `System Management`

## 7. Email Verification

If you want email-code registration:

- [ ] `email.enabled=true`
- [ ] `email.from_name` is set
- [ ] `email.from_address` is set to a verified sender address
- [ ] `email.smtp_host` is set
- [ ] `email.smtp_port` is set
- [ ] `email.smtp_username` is set
- [ ] `email.smtp_password` is set
- [ ] SMTP test mail succeeds from the system page
- [ ] Email verification is enabled in `System Management -> Auth Settings`

If you do not want it yet:

- [ ] `share_auth.email_verification_enabled=false`

References:

- [Email Verification Guide](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)
- [邮箱验证中文说明](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)

## 8. OSS / Object Storage Media Switch

If you want card covers and attachments to use object storage:

- [ ] An object storage config exists in `System Management -> Storage Config`
- [ ] Namespaces exist in `System Management -> Namespaces`
- [ ] In `System Management -> Media Storage`, you selected:
  - one cover namespace
  - one asset namespace
- [ ] `Storage mode` is switched to `object_storage`
- [ ] `Local fallback` remains enabled during the rollout period
- [ ] The backend local storage volume has not been removed yet

If you are not switching yet:

- [ ] `Storage mode` remains `local`

References:

- [Share Media Storage to OSS Guide](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY.md)
- [Share 媒体文件切换到 OSS 指南](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md)

## 9. Final Pre-Start Check

- [ ] `server_name` in Nginx has been changed to the real domain
- [ ] Reverse proxy `/api/share/` points to `backend:8080`
- [ ] No placeholder passwords remain in `.env` or `config.yaml`
- [ ] Volume mounts are correct
- [ ] Image tags are confirmed

## 10. Start Commands

- [ ] You ran:

```bash
docker compose pull
docker compose up -d
```

- [ ] `docker compose ps` shows all core services healthy:
  - `nginx`
  - `sharefrontend`
  - `backend`
  - `postgres`
  - `redis`

## 11. Post-Launch Verification

- [ ] Home page opens correctly
- [ ] Register / login works
- [ ] System management page is accessible
- [ ] New card creation works
- [ ] Card detail page works
- [ ] Attachment download works
- [ ] Email verification behavior matches expectations
- [ ] New uploads in OSS mode can preview and download correctly
- [ ] Historical local files created before the switch are still readable

## 12. Recommended Ongoing Ops

- [ ] Back up regularly:
  - `data/postgres`
  - `backend/storage`
  - `deploy/nginx/ssl`
- [ ] Watch disk usage
- [ ] Clean old images regularly
- [ ] Validate in staging before production upgrades

## 13. Recommended Entry Docs

- [中文部署文档](./README.zh-CN.md)
- [English Deployment Guide](./README.en.md)
- [Backend Config Overview](./backend/config/README.md)
