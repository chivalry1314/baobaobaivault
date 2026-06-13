#!/usr/bin/env bash
set -euo pipefail

# Generate a production-ready configuration for Baobaobai Vault.
# This script only creates files; it does not pull images, start containers,
# or create the admin user. After reviewing the generated files, run:
#
#   docker compose pull
#   docker compose up -d
#   bash scripts/create-admin.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

DEFAULT_BACKEND_IMAGE="ghcr.io/chivalry1314/baobaobaivault-backend:latest"
DEFAULT_FRONTEND_IMAGE="ghcr.io/chivalry1314/baobaobaivault-sharefrontend:latest"

print_usage() {
  cat <<EOF
Usage: $0

Run this script from the project root. The following template files must exist:
  - docker-compose.public.yml
  - deploy/nginx/default.public.conf

Interactive prompts:
  - public domain (e.g. share.example.com)
  - initial super admin email
  - optional pinned image tags (default: latest)

This script only generates configuration files. After it finishes you can edit
backend/config/config.yaml (for email, webpush, etc.), then start the stack and
create the admin with scripts/create-admin.sh.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  print_usage
  exit 0
fi

command -v openssl >/dev/null 2>&1 || { echo "openssl is required"; exit 1; }

random_alnum() {
  local n="$1"
  openssl rand -base64 128 | tr -dc 'A-Za-z0-9' | head -c "$n"
}

random_base64_key() {
  openssl rand -base64 32
}

echo "=== Baobaobai Vault production configuration bootstrap ==="
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

# Ensure required templates exist.
if [[ ! -f "docker-compose.public.yml" ]]; then
  echo "docker-compose.public.yml not found in $PROJECT_DIR"
  exit 1
fi
if [[ ! -f "deploy/nginx/default.public.conf" ]]; then
  echo "deploy/nginx/default.public.conf not found in $PROJECT_DIR"
  exit 1
fi

# Prepare directories.
mkdir -p data/postgres data/redis backend/storage deploy/nginx/ssl backend/config

# Generate strong random secrets.
POSTGRES_PASSWORD="$(random_alnum 32)"
REDIS_PASSWORD="$(random_alnum 32)"
JWT_SECRET="$(random_alnum 64)"
FIELD_ENCRYPTION_KEY="$(random_base64_key)"

if [[ -z "$POSTGRES_PASSWORD" || -z "$REDIS_PASSWORD" || -z "$JWT_SECRET" || -z "$FIELD_ENCRYPTION_KEY" ]]; then
  echo "Failed to generate random secrets."
  exit 1
fi

ENV_PATH="$PROJECT_DIR/.env"
CONFIG_PATH="$PROJECT_DIR/backend/config/config.yaml"
NGINX_CONFIG_PATH="$PROJECT_DIR/deploy/nginx/default.conf"

if [[ -f "$ENV_PATH" || -f "$CONFIG_PATH" ]]; then
  echo
  echo "Configuration files already exist:"
  [[ -f "$ENV_PATH" ]] && echo "  $ENV_PATH"
  [[ -f "$CONFIG_PATH" ]] && echo "  $CONFIG_PATH"
  read -rp "Overwrite? [y/N] " CONFIRM
  if [[ "${CONFIRM,,}" != "y" ]]; then
    exit 1
  fi
fi

echo
echo "Generating .env and backend/config/config.yaml with random secrets..."

cat > "$ENV_PATH" <<EOF
POSTGRES_DB=baobaobaivault
POSTGRES_USER=vaultuser
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD

# Replace the tags if you want a pinned release instead of latest.
BACKEND_IMAGE=$BACKEND_IMAGE
SHAREFRONTEND_IMAGE=$FRONTEND_IMAGE
EOF
chmod 600 "$ENV_PATH"

cat > "$CONFIG_PATH" <<EOF
server:
  port: "8080"
  read_timeout: 30
  write_timeout: 30
  mode: release
  admin_email: "$ADMIN_EMAIL"

cors:
  enabled: true
  allow_origins:
    - "https://$DOMAIN"
  allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  allow_headers: ["Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"]
  expose_headers: ["Content-Disposition", "Content-Length", "ETag"]
  allow_credentials: true
  max_age: 86400

database:
  host: "postgres"
  port: 5432
  user: "vaultuser"
  password: "$POSTGRES_PASSWORD"
  dbname: "baobaobaivault"
  sslmode: "disable"
  max_open_conns: 20
  max_idle_conns: 5
  conn_max_lifetime: 3600

redis:
  host: "redis"
  port: 6379
  password: "$REDIS_PASSWORD"
  db: 0

jwt:
  secret: "$JWT_SECRET"
  expire_time: 24h
  issuer: "baobaobaivault"

security:
  field_encryption_key: "$FIELD_ENCRYPTION_KEY"

storage:
  default_provider: "local"
  temp_dir: "/tmp/baobaobaivault"
  max_file_size: 10737418240

webpush:
  enabled: false
  public_api_enabled: false
  vapid_subject: "mailto:admin@example.com"
  vapid_public_key: ""
  vapid_private_key: ""
  allow_vapid_auto_generate: false
  default_ttl_seconds: 300
  dispatch_api_key: ""
  queue_concurrency: 20
  queue_buffer: 1000
  push_proxy_url: ""

email:
  enabled: false
  from_name: "CardShare"
  from_address: "noreply@example.com"
  smtp_host: "smtp.example.com"
  smtp_port: 587
  smtp_username: "noreply@example.com"
  smtp_password: "change-this-smtp-password"

share_auth:
  email_verification_enabled: false
  verification_code_ttl_seconds: 600
  resend_interval_seconds: 60
  max_verify_attempts: 5

log:
  level: "info"
  format: "json"
EOF
chmod 600 "$CONFIG_PATH"

# Ensure the production Compose and Nginx config files exist.
if [[ ! -f "docker-compose.yml" ]]; then
  cp docker-compose.public.yml docker-compose.yml
  echo "Copied docker-compose.public.yml -> docker-compose.yml"
fi

if [[ ! -f "$NGINX_CONFIG_PATH" ]]; then
  cp deploy/nginx/default.public.conf "$NGINX_CONFIG_PATH"
  echo "Copied deploy/nginx/default.public.conf -> deploy/nginx/default.conf"
fi

echo
echo "=== Configuration generated ==="
echo
echo "Deployment directory: $PROJECT_DIR"
echo "Generated files:"
echo "  $ENV_PATH"
echo "  $CONFIG_PATH"
echo "Copied files:"
echo "  $PROJECT_DIR/docker-compose.yml"
echo "  $NGINX_CONFIG_PATH"
echo
echo "IMPORTANT:"
echo "  - Keep .env and backend/config/config.yaml backed up and secret."
echo "  - Losing security.field_encryption_key will make existing storage credentials unrecoverable."
echo
echo "Next steps:"
echo "  1. (Optional) Edit backend/config/config.yaml for email, webpush, etc."
echo "  2. Place TLS certificates at deploy/nginx/ssl/fullchain.pem and deploy/nginx/ssl/privkey.pem"
echo "  3. Pull images:     docker compose pull"
echo "  4. Start services:  docker compose up -d"
echo "  5. Create admin:    bash scripts/create-admin.sh"
