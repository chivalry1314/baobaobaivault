# Backend config

This project uses a local YAML config file which must not be committed with real secrets.

- Main template: `backend/config/config.example.yaml`
- Public deployment template: `deploy/backend/config.public.example.yaml`
- Local runtime file: copy `backend/config/config.example.yaml` to `backend/config/config.yaml` and edit values
- Backend config search paths: `.` / `./config` / `/etc/baobaobaivault`
- Environment variables are supported via Viper with prefix `BVAULT_`

## Config topics

### Recommended entry

- Primary frontend: `sharefrontend`
- Primary API path: `/api/share/*`
- New deployment and daily operations should follow the `sharefrontend + /api/share` architecture
- `server.admin_email` is the configured super admin identity used by the share system

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

### Share media storage to OSS

- The share card media storage switch is managed in the system UI, not in `config.yaml`
- System page:
  - `System Management -> Media Storage`
  - route: `/system/media-storage`
- This switch only affects newly uploaded share card media
- Historical local files are not migrated automatically in the first stage
- Keep backend local storage mounted during rollout if you enable local fallback
- In `object_storage` mode the browser uploads directly to OSS, so you must also configure:
  - Bucket CORS (production domain and `http://localhost:3002` for local testing)
  - RAM permissions for the backend user: `oss:PutObject`, `oss:GetObject`, `oss:DeleteObject`, `oss:ListObjects`
  - If using `acs:SourceIp` restrictions, whitelist both the backend server IP and your local development IP
- Detailed guides:
  - English: `backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY.md`
  - Chinese: `backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md`

## Notes

- `share_auth.email_verification_enabled=false`: register creates and logs in directly
- `share_auth.email_verification_enabled=true`: register must verify email code first
- For Aliyun Direct Mail, use the same main config templates above and fill `email.*`; no separate provider template is kept
- The local development CORS defaults now target the Next.js share frontend on `http://localhost:3002`
