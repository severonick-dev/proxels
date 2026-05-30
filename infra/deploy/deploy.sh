#!/usr/bin/env bash
# Proxels deploy script.
#
# Запускается ИСКЛЮЧИТЕЛЬНО из API (`POST /api/admin/deploy/run`) — но также
# можно вызывать руками для отладки: `sudo -u proxels /opt/proxels/infra/deploy/deploy.sh v1.2.3`.
#
# Контракт:
#   - Аргумент 1 — git-ref: semver-тег (v1.2.3 / 1.2.3) или `main`.
#   - Работает в `/opt/proxels` (или REPO_DIR из env).
#   - Stdout/stderr пишутся в stdout — API перенаправляет в файл.
#   - Exit code 0 = успех, всё остальное — фейл.
#
# Требования (одноразовая настройка на сервере, см. docs/DEPLOY.md):
#   - User `proxels`, sudoers-правило:
#       proxels ALL=(root) NOPASSWD: /bin/systemctl restart proxels-api
#       proxels ALL=(root) NOPASSWD: /bin/systemctl reload nginx
#   - Установлены node 20+, pnpm 9+, postgres-client (для migrate), rsync.
#   - `pnpm install --frozen-lockfile` отрабатывает без интерактива.

set -euo pipefail

REF="${1:-main}"
REPO_DIR="${REPO_DIR:-/opt/proxels}"
WEB_TARGET="${WEB_TARGET:-/var/www/proxels}"
SYSTEMD_API_UNIT="${SYSTEMD_API_UNIT:-proxels-api}"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { printf '[%s] %s\n' "$(ts)" "$*"; }

trap 'log "DEPLOY FAILED at line $LINENO (exit=$?)"' ERR

log "starting deploy: ref=$REF repo=$REPO_DIR"

cd "$REPO_DIR"

# --- 1. fetch ---------------------------------------------------------------
log "git fetch --tags --prune"
git fetch --tags --prune origin

PREV_SHA="$(git rev-parse HEAD)"
log "previous sha: $PREV_SHA"

# --- 2. checkout ------------------------------------------------------------
# Для тегов используем `tags/<ref>`, для веток — просто `<ref>`. Для всех
# валидных входов сначала пробуем как тег, потом как ветку.
if git rev-parse --verify "refs/tags/$REF" >/dev/null 2>&1; then
  TARGET="tags/$REF"
elif [[ "$REF" == "main" ]]; then
  TARGET="origin/main"
else
  log "ERROR: ref '$REF' not found as tag or branch"
  exit 64
fi

log "checking out $TARGET"
git checkout --detach "$TARGET"
NEW_SHA="$(git rev-parse HEAD)"
log "new sha: $NEW_SHA"

if [[ "$NEW_SHA" == "$PREV_SHA" ]]; then
  log "already at $NEW_SHA — nothing to do"
  exit 0
fi

# --- 3. install + build -----------------------------------------------------
log "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

log "prisma migrate deploy"
pnpm --filter @proxels/api prisma:deploy

log "build api"
pnpm --filter @proxels/api build

log "build web"
pnpm --filter @proxels/web build

# --- 4. publish web ---------------------------------------------------------
if [[ -d "apps/web/dist" ]]; then
  log "rsync apps/web/dist/ → $WEB_TARGET/"
  mkdir -p "$WEB_TARGET"
  rsync -a --delete apps/web/dist/ "$WEB_TARGET/"
fi

# --- 5. restart api + reload nginx -----------------------------------------
log "systemctl restart $SYSTEMD_API_UNIT"
sudo /bin/systemctl restart "$SYSTEMD_API_UNIT"

log "nginx reload"
sudo /bin/systemctl reload nginx || log "nginx reload failed (non-fatal)"

log "DEPLOY OK · ref=$REF · sha=$NEW_SHA (was $PREV_SHA)"
