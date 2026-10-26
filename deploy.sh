#!/usr/bin/env bash
# One-shot, idempotent deploy of FleetFlow to Fly.io.
#
#   bash deploy.sh
#
# Requires: ~/.fly/bin/flyctl on PATH (or FLYCTL), a billed Fly org, and the
# Clerk keys in backend/.env / frontend/.env. Generated secrets are stored in
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
# shellcheck disable=SC1090
set -a; . "./$SECRETS"; set +a
# shellcheck disable=SC1090
. ./backend/.env; eval "$(grep -E '^CLERK_SECRET_KEY=' backend/.env)"
CLERK_PUB="${VITE_CLERK_PUBLISHABLE_KEY:-$(grep -E '^VITE_CLERK_PUBLISHABLE_KEY=' frontend/.env | cut -d= -f2- | tr -d '"')}"

# ---------- generate + persist the secrets we own ----------
save() { # save KEY VALUE
  if grep -q "^$1=" "$SECRETS" 2>/dev/null; then
    python - "$SECRETS" "$1" "$2" <<'PY'
import sys
p,k,v=sys.argv[1:4]
out=[]
for line in open(p,encoding='utf-8'):
    out.append(f"{k}={v}\n" if line.startswith(k+"=") else line)
open(p,'w',encoding='utf-8').writelines(out)
PY
  else
    printf '%s=%s\n' "$1" "$2" >> "$SECRETS"
  fi
}

[ -n "${MONGO_ROOT_PASSWORD:-}" ] || { MONGO_ROOT_PASSWORD="$(openssl rand -hex 16)"; save MONGO_ROOT_PASSWORD "$MONGO_ROOT_PASSWORD"; }
[ -n "${JWT_SECRET:-}" ] || { JWT_SECRET="$(openssl rand -hex 32)"; save JWT_SECRET "$JWT_SECRET"; }
[ -n "${CLERK_SECRET_KEY:-}" ] || { echo "CLERK_SECRET_KEY missing from backend/.env"; exit 1; }
[ -n "$CLERK_PUB" ] || { echo "VITE_CLERK_PUBLISHABLE_KEY missing from frontend/.env"; exit 1; }

host_for() { "$FLY" apps list --json 2>/dev/null | grep -q "\"$1\"" && return 0; return 1; }

echo "==> apps"
for name in "$DB_APP" "$APP"; do
  if host_for "$name"; then echo "    $name exists"; else
    "$FLY" apps create "$name" -o personal || { echo "cannot create $name — add a card at https://fly.io/dashboard/akash-kishore/billing"; exit 1; }
  fi
done

echo "==> volume for MongoDB"
"$FLY" volumes list --app "$DB_APP" 2>/dev/null | grep -q mongo_data \
  || "$FLY" volumes create mongo_data --app "$DB_APP" --region "$REGION" --size 1 -y

echo "==> database secrets + boot"
"$FLY" secrets set --app "$DB_APP" MONGO_INITDB_ROOT_USERNAME=fleetflow MONGO_INITDB_ROOT_PASSWORD="$MONGO_ROOT_PASSWORD" >/dev/null
"$FLY" deploy --app "$DB_APP" --config deploy/mongo/fly.toml --ha=false

echo "==> app secrets"
MONGO_URI="mongodb://fleetflow:${MONGO_ROOT_PASSWORD}@${DB_APP}.internal:27017/fleetflow?authSource=admin"
"$FLY" secrets set --app "$APP" \
  MONGODB_URI="$MONGO_URI" \
  JWT_SECRET="$JWT_SECRET" \
  FRONTEND_URL="https://${APP}.fly.dev" \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  CLERK_DEFAULT_ORG_SLUG="${CLERK_DEFAULT_ORG_SLUG:-fleetflow-demo}" >/dev/null

echo "==> deploy app"
"$FLY" deploy --app "$APP" --build-arg VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUB" --ha=false

echo "==> seed demo data"
"$FLY" ssh console --app "$APP" -C "node seed-demo-data.js" || echo "    (seed was skipped or partial — rerun later)"

echo
echo "live: https://${APP}.fly.dev"
echo "login: admin@fleetflow.io / FleetFlow@2026"
