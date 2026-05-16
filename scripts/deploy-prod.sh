#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy-prod.sh <server_host>
# Example:
#   ./scripts/deploy-prod.sh mon.serveur.com

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <server_host>"
  exit 1
fi

SERVER_HOST="$1"
SERVER_USER="doprrweb"
SERVER="${SERVER_USER}@${SERVER_HOST}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK_DIR="${ROOT_DIR}/api-maconducoeur"
FRONT_DIR="${ROOT_DIR}/maconducoeur"

REMOTE_BACK_DIR="/var/www/doprrweb/services/maconducoeur"
REMOTE_FRONT_DIR="/var/www/doprrweb/apps/maconducoeur"

echo "[1/7] Build backend (production)"
cd "${BACK_DIR}"
npm ci
npm run build

echo "[2/7] Build frontend (production)"
cd "${FRONT_DIR}"
npm ci
npm run build -- --configuration production

# Angular 21 output usually lives in dist/<app>/browser
FRONT_DIST_CANDIDATE_1="${FRONT_DIR}/dist/maconducoeur/"
FRONT_DIST_CANDIDATE_2="${FRONT_DIR}/dist/maconducoeur"
if [[ -d "${FRONT_DIST_CANDIDATE_1}" ]]; then
  FRONT_DIST_DIR="${FRONT_DIST_CANDIDATE_1}"
elif [[ -d "${FRONT_DIST_CANDIDATE_2}" ]]; then
  FRONT_DIST_DIR="${FRONT_DIST_CANDIDATE_2}"
else
  echo "Frontend dist folder not found."
  exit 1
fi

echo "[3/6] Upload backend build + runtime files"
rsync -avz --delete \
  --exclude '.env' \
  --exclude 'node_modules' \
  "${BACK_DIR}/dist/" "${SERVER}:${REMOTE_BACK_DIR}/dist/"

rsync -avz \
  "${BACK_DIR}/package.json" \
  "${BACK_DIR}/package-lock.json" \
  "${SERVER}:${REMOTE_BACK_DIR}/"

echo "[4/6] Install backend prod dependencies on remote"
ssh "${SERVER}" "cd '${REMOTE_BACK_DIR}' && npm ci --omit=dev"

echo "[5/6] Upload frontend dist"
rsync -avz --delete "${FRONT_DIST_DIR}/" "${SERVER}:${REMOTE_FRONT_DIR}/"

echo "[6/6] Done"
echo "Deployment completed."
echo "Next: restart your backend process on server (pm2/systemd)."
