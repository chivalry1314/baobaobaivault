# Backend config

This project uses a local YAML config file which **must not** be committed with real secrets.

- Copy `backend/config/config.example.yaml` to `backend/config/config.yaml` and edit values.
- The backend searches for `config.yaml` in: `.` / `./config` / `/etc/baobaobaivault` (see `backend/internal/config/config.go`).
- Environment variables are supported via Viper with prefix `BVAULT_`.

