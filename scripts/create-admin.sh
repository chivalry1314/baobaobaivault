#!/usr/bin/env bash
set -euo pipefail

# Create the initial Baobaobai Vault super admin.
# Run this after the stack is healthy (docker compose up -d).

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

print_usage() {
  cat <<EOF
Usage: $0

Run this script from the project root after the stack is up:

  docker compose up -d
  bash scripts/create-admin.sh

It interactively asks for the admin email, generates a strong random password,
creates the manager account, and prints the one-time password.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  print_usage
  exit 0
fi

command -v openssl >/dev/null 2>&1 || { echo "openssl is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required"
  exit 1
fi

# Try to read admin_email from the generated config as a default.
DEFAULT_EMAIL=""
if [[ -f "backend/config/config.yaml" ]]; then
  DEFAULT_EMAIL="$(grep -E '^\s*admin_email:' backend/config/config.yaml | head -n 1 | sed -E 's/^\s*admin_email:\s*"?([^"]*)"?\s*$/\1/' || true)"
fi

if [[ -n "$DEFAULT_EMAIL" ]]; then
  read -rp "Admin email [$DEFAULT_EMAIL]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-$DEFAULT_EMAIL}"
else
  read -rp "Admin email: " ADMIN_EMAIL
fi

ADMIN_EMAIL="$(echo "$ADMIN_EMAIL" | tr -d '[:space:]')"
if [[ -z "$ADMIN_EMAIL" ]] || [[ ! "$ADMIN_EMAIL" =~ @ ]]; then
  echo "A valid admin email is required."
  exit 1
fi

echo
echo "Waiting for backend health check..."
for i in $(seq 1 30); do
  if docker compose exec -T backend wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Backend did not become healthy within 60 seconds."
    echo "Check logs: docker compose logs -f backend"
    exit 1
  fi
  sleep 2
done

ADMIN_PASSWORD="$(openssl rand -base64 24)"

echo
echo "Creating super admin..."
docker compose exec -T backend /app/server create-admin \
  --email "$ADMIN_EMAIL" \
  --password "$ADMIN_PASSWORD" \
  --force-password-change

echo
echo "=== Admin user created ==="
echo
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo
echo "Save this password now. It will not be shown again."
