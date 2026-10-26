#!/usr/bin/env bash
# One-shot, idempotent deploy of FleetFlow to Fly.io.
#
#   bash deploy.sh
#
# Requires: ~/.fly/bin/flyctl on PATH (or FLYCTL), a billed Fly org, and the
# Clerk keys in backend/.env + frontend/.env. Generated secrets are stored in
# deploy.secrets.env, which is git-ignored.
set -euo pipefail

cd "$(dirname "$0")"
export PATH="$HOME/.fly/bin:$PATH"
FLY="${FLYCTL:-flyctl}"

APP="${FLY_APP:-fleetflow}"
DB_APP="${FLY_DB_APP:-fleetflow-db}"
REGION="${FLY_REGION:-bom}"
SECRETS=deploy.secrets.env

[ -f "$SECRETS" ] || { echo "missing $SECRETS"; exit 1; }

# Read only the values we need from .env files; never source them, so a local
# dev MONGODB_URI or JWT_SECRET can never leak into the deployed app.
envval() { # envval FILE KEY
  { grep -E "^$2=" "$1" 2>/dev/null || true; } | head -1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//"
}

# shellcheck disable=SC1090
set -a; . "./$SECRETS"; set +a

CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-$(envval backend/.env CLERK_SECRET_KEY)}"
CLERK_ORG_SLUG="${CLERK_DEFAULT_ORG_SLUG:-$(envval backend/.env CLERK_DEFAULT_ORG_SLUG)}"
CLERK_ORG_SLUG="${CLERK_ORG_SLUG:-fleetflow-demo}"
CLERK_PUB="$(envval frontend/.env VITE_CLERK_PUBLISHABLE_KEY)"

[ -n "$CLERK_SECRET_KEY" ] || { echo "CLERK_SECRET_KEY missing from backend/.env"; exit 1; }
[ -n "$CLERK_PUB" ] || { echo "VITE_CLERK_PUBLISHABLE_KEY missing from frontend/.env"; exit 1; }

# ---------- generate + persist the secrets we own ----------
save() { # save KEY VALUE  (idempotent, no python dependency)
  local k="$1" v="$2" tmp="$SECRETS.tmp"
  awk -v k="$k" -v v="$v" '
    index($0, k"=") == 1 { print k"="v; found = 1; next }
    { print }
    END { if (!found) print k"="v }
  ' "$SECRETS" > "$tmp" && mv "$tmp" "$SECRETS"
}

[ -n "${MONGO_ROOT_PASSWORD:-}" ] || {
  MONGO_ROOT_PASSWORD="$(openssl rand -hex 16)"; save MONGO_ROOT_PASSWORD "$MONGO_ROOT_PASSWORD"
}
[ -n "${JWT_SECRET:-}" ] || {
  JWT_SECRET="$(openssl rand -hex 32)"; save JWT_SECRET "$JWT_SECRET"
}

app_exists() { "$FLY" apps list --json 2>/dev/null | grep -q "\"name\":\"$1\""; }

echo "==> apps"
for name in "$DB_APP" "$APP"; do
  if app_exists "$name"; then
    echo "    $name exists"
  else
    "$FLY" apps create "$name" -o personal || {
      echo "cannot create $name — add a card at https://fly.io/dashboard/akash-kishore/billing"
      exit 1
    }
  fi
done

echo "==> volume for MongoDB"
"$FLY" volumes list --app "$DB_APP" 2>/dev/null | grep -q mongo_data \
  || "$FLY" volumes create mongo_data --app "$DB_APP" --region "$REGION" --size 1 -y

echo "==> database secrets + boot"
"$FLY" secrets set --app "$DB_APP" \
  MONGO_INITDB_ROOT_USERNAME=fleetflow \
  MONGO_INITDB_ROOT_PASSWORD="$MONGO_ROOT_PASSWORD" >/dev/null
"$FLY" deploy --app "$DB_APP" --config deploy/mongo/fly.toml --ha=false

echo "==> app secrets"
MONGO_URI="mongodb://fleetflow:${MONGO_ROOT_PASSWORD}@${DB_APP}.internal:27017/fleetflow?authSource=admin"
"$FLY" secrets set --app "$APP" \
  MONGODB_URI="$MONGO_URI" \
  JWT_SECRET="$JWT_SECRET" \
  FRONTEND_URL="https://${APP}.fly.dev" \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  CLERK_DEFAULT_ORG_SLUG="$CLERK_ORG_SLUG" >/dev/null

echo "==> deploy app"
"$FLY" deploy --app "$APP" \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUB" --ha=false

echo "==> seed demo data"
"$FLY" ssh console --app "$APP" -C "node seed-demo-data.js" \
  || echo "    (seed skipped or partial — rerun bash deploy.sh to retry)"

echo
echo "live:  https://${APP}.fly.dev"
echo "login: admin@fleetflow.io / FleetFlow@2026"
