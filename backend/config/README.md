# Backend config

This project uses a local YAML config file which **must not** be committed with real secrets.

- Copy `backend/config/config.example.yaml` to `backend/config/config.yaml` and edit values.
- The backend searches for `config.yaml` in: `.` / `./config` / `/etc/baobaobaivault` (see `backend/internal/config/config.go`).
- Environment variables are supported via Viper with prefix `BVAULT_`.

## Web Push (optional)

This repo can expose a standalone, `mimiwebpushserver`-compatible Web Push API under `/api/*` when `webpush.enabled=true` and `webpush.public_api_enabled=true`.

- Generate VAPID keys: `go run ./cmd/webpushvapid`
- Configure `webpush.vapid_public_key` / `webpush.vapid_private_key` in `config.yaml`
