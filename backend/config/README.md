# Backend config

This project uses a local YAML config file which **must not** be committed with real secrets.

- Copy `backend/config/config.example.yaml` to `backend/config/config.yaml` and edit values.
- The backend searches for `config.yaml` in: `.` / `./config` / `/etc/baobaobaivault` (see `backend/internal/config/config.go`).
- Environment variables are supported via Viper with prefix `BVAULT_`.

## Bootstrap admin (To C single-instance mode)

The project now uses single-instance To C mode (no organization isolation model).

- Public bootstrap API (optional): `POST /api/v1/bootstrap/admin`
  - Controlled by: `server.allow_public_bootstrap`
- Auto bootstrap at startup (optional):
  - `server.auto_bootstrap_admin`
  - `server.admin_email`
  - `server.admin_password`
  - `server.admin_username`
  - `server.admin_nickname`

## Web Push (optional)

This repo can expose a standalone, `mimiwebpushserver`-compatible Web Push API under `/api/*` when `webpush.enabled=true` and `webpush.public_api_enabled=true`.

- Generate VAPID keys: `go run ./cmd/webpushvapid`
- Configure `webpush.vapid_public_key` / `webpush.vapid_private_key` in `config.yaml`
