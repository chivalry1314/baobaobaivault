# Backend config

This project uses a local YAML config file which must not be committed with real secrets.

- Main template: `backend/config/config.example.yaml`
- Public deployment template: `deploy/backend/config.public.example.yaml`
- Local runtime file: copy `backend/config/config.example.yaml` to `backend/config/config.yaml` and edit values
- Backend config search paths: `.` / `./config` / `/etc/baobaobaivault`
- Environment variables are supported via Viper with prefix `BVAULT_`

## Config topics

### Bootstrap admin

- Public bootstrap API (optional): `POST /api/v1/bootstrap/admin`
- Main fields:
  - `server.allow_public_bootstrap`
  - `server.auto_bootstrap_admin`
  - `server.admin_email`
  - `server.admin_password`
  - `server.admin_username`
  - `server.admin_nickname`

### Web Push

This repo can expose a standalone `mimiwebpushserver`-compatible Web Push API under `/api/*` when `webpush.enabled=true` and `webpush.public_api_enabled=true`.

- Generate VAPID keys: `go run ./cmd/webpushvapid`
- Main fields:
  - `webpush.enabled`
  - `webpush.public_api_enabled`
  - `webpush.vapid_public_key`
  - `webpush.vapid_private_key`

### Share email verification

- Main switch:
  - `share_auth.email_verification_enabled`
- Main SMTP fields:
  - `email.enabled`
  - `email.from_name`
  - `email.from_address`
  - `email.smtp_host`
  - `email.smtp_port`
  - `email.smtp_username`
  - `email.smtp_password`
- Detailed guides:
  - English: `backend/config/SHARE_AUTH_EMAIL_DEPLOY.md`
  - Chinese: `backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md`

## Notes

- `share_auth.email_verification_enabled=false`: register creates and logs in directly
- `share_auth.email_verification_enabled=true`: register must verify email code first
- For Aliyun Direct Mail, use the same main config templates above and fill `email.*`; no separate provider template is kept
