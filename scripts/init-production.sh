#!/usr/bin/env bash
set -euo pipefail

# Production bootstrap script for Baobaobai Vault.
# Generates a secure .env and backend/config/config.yaml, starts the Docker
# Compose stack, and creates the initial super admin.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

DEFAULT_BACKEND_IMAGE="ghcr.io/chivalry1314/baobaobaivault-backend:latest"
DEFAULT_FRONTEND_IMAGE="ghcr.io/chivalry1314/baobaobaivault-sharefrontend:latest"

print_usage() {
  cat <<EOF
Usage: $0

Interactive script. You will be prompted for:
  - public domain (e.g. share.example.com)
  - initial super admin email
  - optional pinned image tags (default: latest)

Prerequisites:
  - Docker Engine
  - Docker Compose plugin
  - OpenSSL
  - Nginx SSL certificates placed at deploy/nginx/ssl/
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  print_usage
  exit 0
fi

command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required"; exit 1; }
if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required"
  exit 1
fi

echo "=== Baobaobai Vault production bootstrap ==="
echo

read -rp "Public domain (e.g. share.example.com): " DOMAIN
DOMAIN="$(echo "$DOMAIN" | tr -d '[:space:]')"
if [[ -z "$DOMAIN" ]]; then
  echo "Domain is required."
  exit 1
fi
if [[ "$DOMAIN" =~ ^https?:// ]]; then
  echo "Please enter the domain without https://"
  exit 1
fi

read -rp "Initial super admin email: " ADMIN_EMAIL
ADMIN_EMAIL="$(echo "$ADMIN_EMAIL" | tr -d '[:space:]')"
if [[ -z "$ADMIN_EMAIL" ]] || [[ ! "$ADMIN_EMAIL" =~ @ ]]; then
  echo "A valid admin email is required."
  exit 1
fi

read -rp "Backend image tag [$DEFAULT_BACKEND_IMAGE]: " BACKEND_IMAGE
BACKEND_IMAGE="${BACKEND_IMAGE:-$DEFAULT_BACKEND_IMAGE}"
read -rp "Frontend image tag [$DEFAULT_FRONTEND_IMAGE]: " FRONTEND_IMAGE
FRONTEND_IMAGE="${FRONTEND_IMAGE:-$DEFAULT_FRONTEND_IMAGE}"

if [[ ! -f "deploy/nginx/ssl/fullchain.pem" || ! -f "deploy/nginx/ssl/privkey.pem" ]]; then
  echo
  echo "WARNING: Nginx certificates not found at deploy/nginx/ssl/"
  echo "  Expected: deploy/nginx/ssl/fullchain.pem"
  echo "  Expected: deploy/nginx/ssl/privkey.pem"
  read -rp "Continue anyway? [y/N] " CONFIRM
  if [[ "${CONFIRM,,}" != "y" ]]; then
    exit 1
  fi
fi

# Prepare persistent directories and config layout.
mkdir -p data/postgres data/redis backend/storage deploy/nginx/ssl

# Use the published backend image to generate configuration files on the host.
# This step does not require a running database.
echo
echo "Generating .env and backend/config/config.yaml with random secrets..."
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$PROJECT_DIR:/host" \
  -w /host \
  "$BACKEND_IMAGE" \
  /app/server bootstrap \
    --generate-only \
    --out /host \
    --admin-email "$ADMIN_EMAIL" \
    --domain "$DOMAIN" \
    --backend-image "$BACKEND_IMAGE" \
    --frontend-image "$FRONTEND_IMAGE"

# Ensure the production Compose file exists.
if [[ ! -f "docker-compose.yml" ]]; then
  if [[ -f "docker-compose.public.yml" ]]; then
    cp docker-compose.public.yml docker-compose.yml
    echo "Copied docker-compose.public.yml -> docker-compose.yml"
  else
    echo "docker-compose.public.yml not found."
    exit 1
  fi
fi

echo
echo "Starting services..."
docker compose up -d

# Generate a one-time admin password and create the super admin.
ADMIN_PASSWORD="$(openssl rand -base64 24)"

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

echo
echo "Creating initial super admin..."
docker compose exec -T backend /app/server create-admin \
  --email "$ADMIN_EMAIL" \
  --password "$ADMIN_PASSWORD"

echo
echo "=== Bootstrap complete ==="
echo
echo "Deployment directory: $PROJECT_DIR"
echo "Configuration files:"
echo "  $PROJECT_DIR/.env"
echo "  $PROJECT_DIR/backend/config/config.yaml"
echo
echo "Initial super admin:"
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo
echo "Site URL: https://$DOMAIN"
echo
echo "IMPORTANT:"
echo "  - Save the admin password now. It will not be shown again."
echo "  - Keep .env and backend/config/config.yaml backed up and secret."
echo "  - Losing security.field_encryption_key will make existing storage credentials unrecoverable."
echo
echo "Next steps:"
echo "  - Verify: docker compose ps"
echo "  - Logs:    docker compose logs -f"
echo "  - System management is available after login at /system"
