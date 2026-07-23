#!/usr/bin/env bash
# =============================================================================
# sub2api Blue-Green upgrade tool  (burntoken.org)
# -----------------------------------------------------------------------------
# Backend: always latest from your fork (ZHJay/BurnTokenRouter, tracks upstream
#          Wei-Shaw/sub2api). Frontend: your Apple redesign, embedded into the
#          Go binary at build time.
#
# Strategy: generic blue/green. The script auto-detects which color is live by
#           reading the nginx proxy_pass port, builds+starts the *other* color,
#           health-checks it, then flips nginx (graceful reload = zero downtime).
#           The previous color is kept running for instant rollback.
#
# Runs ON the 大站 server (as ubuntu, uses passwordless sudo). Not meant to be
# run from the laptop; copy it up and execute there (see companion notes).
#
# Subcommands:
#   deploy    (default) full build + green bring-up + nginx flip
#   rollback  flip nginx back to the other color and reload (seconds)
#   status    show both containers, versions, live port, shared pg/redis health
#   cleanup   stop+remove the non-live (old) container and its data-dir copy
#
# Flags:
#   --branch <name>        git branch to build   (default: codex/apple-frontend-redesign)
#   --version-label <str>  override VERSION label (default: 0.1.<official>-burntoken)
#   --no-build             reuse existing image, skip docker build
#   --yes                  skip interactive confirmations
#   -h | --help            show help
# =============================================================================
set -euo pipefail

# ------------------------------------------------------------------ config ---
# NOTE: run this on the server. SSH key path below is only used if you set
# RUN_REMOTE=1 to have the script re-exec itself over SSH from a laptop.
SSH_KEY="/Users/zhanghjay/Desktop/KEYS/key_for_129.146.121.188/ssh-key-2026-07-03-2.key"
SSH_USER="ubuntu"
SSH_HOST="129.146.121.188"
SSH_PORT="22"

REPO_URL="https://github.com/ZHJay/BurnTokenRouter.git"
SRC_DIR="/root/burntoken-src"
DEPLOY_DIR="/root/sub2api-deploy"
BACKUP_DIR="${DEPLOY_DIR}/backups"
NGINX_SITE="/etc/nginx/sites-available/burntoken.org"
PUBLIC_URL="https://burntoken.org"

DOCKER_NETWORK="sub2api-deploy_sub2api-network"
PG_CONTAINER="sub2api-postgres"
REDIS_CONTAINER="sub2api-redis"
IMAGE_REPO="sub2api"
LATEST_TAG="sub2api:burntoken-latest"
CONTAINER_PORT="8080"          # in-container listen port (SERVER_PORT)

# Blue/green definitions. Each color = (container name, host port, data dir).
BLUE_NAME="sub2api";        BLUE_PORT="8080";  BLUE_DATA="${DEPLOY_DIR}/data"
GREEN_NAME="sub2api-green"; GREEN_PORT="8081"; GREEN_DATA="${DEPLOY_DIR}/green_data"

# Build args (China-friendly proxies, matches how the live image was built).
GOPROXY_VAL="https://goproxy.cn,direct"
GOSUMDB_VAL="sum.golang.google.cn"

# ------------------------------------------------------------ CLI defaults ---
BRANCH="codex/apple-frontend-redesign"
VERSION_LABEL=""
NO_BUILD=0
ASSUME_YES=0
CMD="deploy"

# --------------------------------------------------------------- coloring ---
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_INFO=$'\033[36m'; C_OK=$'\033[32m'
  C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'
else
  C_RESET=""; C_INFO=""; C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_B=""
fi
log()  { printf '%s[INFO]%s %s\n' "$C_INFO" "$C_RESET" "$*"; }
ok()   { printf '%s[OK]%s   %s\n' "$C_OK"   "$C_RESET" "$*"; }
warn() { printf '%s[WARN]%s %s\n' "$C_WARN" "$C_RESET" "$*" >&2; }
err()  { printf '%s[ERR]%s  %s\n' "$C_ERR"  "$C_RESET" "$*" >&2; }
die()  { err "$*"; exit 1; }
hr()   { printf '%s%s%s\n' "$C_DIM" "----------------------------------------------------------------" "$C_RESET"; }

# sudo helper: on the server ubuntu has passwordless sudo; if already root skip.
SUDO="sudo"
if [ "$(id -u)" = "0" ]; then SUDO=""; fi
dk() { $SUDO docker "$@"; }

confirm() {
  # confirm "message"  -> returns 0 if yes
  local msg="$1"
  if [ "$ASSUME_YES" = "1" ]; then return 0; fi
  printf '%s%s%s [y/N] ' "$C_WARN" "$msg" "$C_RESET"
  read -r ans </dev/tty || return 1
  case "$ans" in [yY]|[yY][eE][sS]) return 0;; *) return 1;; esac
}

usage() {
  sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# --------------------------------------------------------- arg parsing ------
parse_args() {
  # first non-flag token is the subcommand
  local positional=0
  while [ $# -gt 0 ]; do
    case "$1" in
      deploy|rollback|status|cleanup) CMD="$1"; positional=1; shift;;
      --branch)        BRANCH="${2:?--branch needs a value}"; shift 2;;
      --branch=*)      BRANCH="${1#*=}"; shift;;
      --version-label) VERSION_LABEL="${2:?--version-label needs a value}"; shift 2;;
      --version-label=*) VERSION_LABEL="${1#*=}"; shift;;
      --no-build)      NO_BUILD=1; shift;;
      --yes|-y)        ASSUME_YES=1; shift;;
      -h|--help)       usage;;
      *) if [ "$positional" = "0" ]; then CMD="$1"; positional=1; shift;
         else die "unknown argument: $1"; fi;;
    esac
  done
}

# ---------------------------------------------------- topology detection ----
# Reads the live proxy_pass port out of the nginx site file.
detect_live_port() {
  local p
  p="$($SUDO grep -oE 'proxy_pass[[:space:]]+http://127\.0\.0\.1:[0-9]+' "$NGINX_SITE" \
        | grep -oE '[0-9]+$' | head -1 || true)"
  [ -n "$p" ] || die "could not parse proxy_pass port from $NGINX_SITE"
  printf '%s' "$p"
}

# Given the live port, populate LIVE_* and TARGET_* globals for both colors.
resolve_colors() {
  LIVE_PORT="$(detect_live_port)"
  case "$LIVE_PORT" in
    "$BLUE_PORT")
      LIVE_COLOR="blue";  LIVE_NAME="$BLUE_NAME";  LIVE_DATA="$BLUE_DATA"
      TARGET_COLOR="green"; TARGET_NAME="$GREEN_NAME"; TARGET_PORT="$GREEN_PORT"; TARGET_DATA="$GREEN_DATA"
      ;;
    "$GREEN_PORT")
      LIVE_COLOR="green"; LIVE_NAME="$GREEN_NAME"; LIVE_DATA="$GREEN_DATA"
      TARGET_COLOR="blue"; TARGET_NAME="$BLUE_NAME"; TARGET_PORT="$BLUE_PORT"; TARGET_DATA="$BLUE_DATA"
      ;;
    *)
      die "live port $LIVE_PORT is neither blue($BLUE_PORT) nor green($GREEN_PORT); refusing to guess"
      ;;
  esac
}

container_exists() { dk ps -a --format '{{.Names}}' | grep -qx "$1"; }
container_running() { dk ps --format '{{.Names}}' | grep -qx "$1"; }

container_version() {
  # prints the version string or "-" if not reachable
  local name="$1"
  if container_running "$name"; then
    dk exec "$name" /app/sub2api --version 2>/dev/null \
      | grep -oE 'Sub2API [0-9][^ ]*' | head -1 || echo "-"
  else echo "-"; fi
}

container_health() {
  local name="$1"
  container_exists "$name" || { echo "absent"; return; }
  dk inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || echo "?"
}

bundle_hash() {
  # fetch the assets/index-*.js bundle name from a running color's port
  local port="$1"
  curl -fsS --max-time 5 "http://127.0.0.1:${port}/" 2>/dev/null \
    | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1 || echo "-"
}

# ---------------------------------------------------------- status cmd ------
cmd_status() {
  resolve_colors
  hr
  printf '%ssub2api blue-green status%s\n' "$C_B" "$C_RESET"
  hr
  log "nginx live port : ${C_B}${LIVE_PORT}${C_RESET}  -> ${LIVE_COLOR} (${LIVE_NAME})"
  printf '\n'
  printf '  %-20s %-6s %-10s %-26s %s\n' "COLOR/NAME" "PORT" "HEALTH" "VERSION" "BUNDLE"
  for spec in "blue $BLUE_NAME $BLUE_PORT" "green $GREEN_NAME $GREEN_PORT"; do
    set -- $spec; local color="$1" name="$2" port="$3"
    local mark="  "; [ "$name" = "$LIVE_NAME" ] && mark="${C_OK}* ${C_RESET}"
    printf '%s%-18s %-6s %-10s %-26s %s\n' "$mark" \
      "$color/$name" "$port" "$(container_health "$name")" \
      "$(container_version "$name")" "$(bundle_hash "$port")"
  done
  printf '\n'
  log "shared services:"
  printf '    %-18s %s\n' "$PG_CONTAINER"    "$(container_health "$PG_CONTAINER")"
  printf '    %-18s %s\n' "$REDIS_CONTAINER" "$(container_health "$REDIS_CONTAINER")"
  printf '\n'
  local pub; pub="$(curl -fsS --max-time 8 "${PUBLIC_URL}/health" 2>/dev/null || echo 'unreachable')"
  log "public ${PUBLIC_URL}/health : ${pub}"
  hr
}

# ------------------------------------------------------ nginx flip helper ---
# switch_nginx <from_port> <to_port>
switch_nginx() {
  local from="$1" to="$2"
  local ts backup
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  backup="${NGINX_SITE}.bak-${ts}"
  log "backing up nginx site -> ${backup}"
  $SUDO cp -a "$NGINX_SITE" "$backup"
  log "rewriting proxy_pass :${from} -> :${to}"
  $SUDO sed -i "s#proxy_pass http://127\.0\.0\.1:${from};#proxy_pass http://127.0.0.1:${to};#g" "$NGINX_SITE"
  if ! $SUDO nginx -t; then
    err "nginx -t FAILED; restoring previous config"
    $SUDO cp -a "$backup" "$NGINX_SITE"
    die "nginx config invalid; no reload performed (restored from backup)"
  fi
  $SUDO systemctl reload nginx
  ok "nginx reloaded; live port is now :${to}"
}

# --------------------------------------------------------- rollback cmd -----
cmd_rollback() {
  resolve_colors
  local other_port
  if [ "$LIVE_PORT" = "$BLUE_PORT" ]; then other_port="$GREEN_PORT"; else other_port="$BLUE_PORT"; fi
  local other_name; [ "$other_port" = "$BLUE_PORT" ] && other_name="$BLUE_NAME" || other_name="$GREEN_NAME"

  log "current live : :${LIVE_PORT} (${LIVE_NAME})"
  log "rollback to  : :${other_port} (${other_name})"
  if ! container_running "$other_name"; then
    die "target container '${other_name}' is not running; cannot roll back to it. Check: sudo docker ps -a"
  fi
  if [ "$(container_health "$other_name")" != "healthy" ]; then
    warn "target container '${other_name}' health is not 'healthy' (=$(container_health "$other_name"))."
    confirm "Roll back to it anyway?" || die "aborted by user"
  fi
  confirm "Flip nginx from :${LIVE_PORT} to :${other_port}?" || die "aborted by user"
  switch_nginx "$LIVE_PORT" "$other_port"
  sleep 1
  local pub; pub="$(curl -fsS --max-time 8 "${PUBLIC_URL}/health" 2>/dev/null || echo 'unreachable')"
  ok "rollback done. ${PUBLIC_URL}/health -> ${pub}"
}

# --------------------------------------------------------- cleanup cmd ------
cmd_cleanup() {
  resolve_colors
  # the "old"/non-live color is the TARGET_* of a *previous* deploy = current non-live
  local old_name old_data old_port
  if [ "$LIVE_NAME" = "$BLUE_NAME" ]; then
    old_name="$GREEN_NAME"; old_data="$GREEN_DATA"; old_port="$GREEN_PORT"
  else
    old_name="$BLUE_NAME"; old_data="$BLUE_DATA"; old_port="$BLUE_PORT"
  fi
  log "live color   : ${LIVE_COLOR} (${LIVE_NAME}) :${LIVE_PORT}"
  log "will remove  : ${old_name} :${old_port}  + data dir ${old_data}"
  if ! container_exists "$old_name"; then
    warn "container '${old_name}' does not exist; nothing to stop/remove."
  else
    confirm "Stop & remove container '${old_name}'?" || die "aborted by user"
    log "stopping ${old_name}"; dk stop "$old_name" >/dev/null 2>&1 || true
    log "removing ${old_name}"; dk rm   "$old_name" >/dev/null 2>&1 || true
    ok "container ${old_name} removed"
  fi
  # Data dir removal is destructive and irreversible -> extra guard.
  case "$old_data" in
    "$BLUE_DATA"|"$GREEN_DATA") : ;;   # only allow the two known dirs
    *) die "refusing to delete unexpected data dir: $old_data";;
  esac
  if [ -d "$old_data" ]; then
    warn "Data dir ${old_data} holds the old color's /app/data copy (NOT the shared DB)."
    if confirm "Delete data dir ${old_data}? (irreversible)"; then
      $SUDO rm -rf -- "$old_data"
      ok "removed ${old_data}"
    else
      log "kept ${old_data}"
    fi
  fi
  ok "cleanup complete"
}

# ---------------------------------------------------------- deploy cmd ------
sync_source() {
  log "syncing source: ${REPO_URL} @ ${BRANCH}"
  if [ ! -d "$SRC_DIR/.git" ]; then
    $SUDO git clone "$REPO_URL" "$SRC_DIR"
  fi
  $SUDO git -C "$SRC_DIR" fetch --prune origin
  $SUDO git -C "$SRC_DIR" checkout -B "$BRANCH" "origin/${BRANCH}"
  $SUDO git -C "$SRC_DIR" reset --hard "origin/${BRANCH}"
  GIT_SHORT="$($SUDO git -C "$SRC_DIR" rev-parse --short HEAD)"
  ok "source at ${BRANCH} commit ${GIT_SHORT}"
}

resolve_version_label() {
  if [ -n "$VERSION_LABEL" ]; then return; fi
  local base=""
  # exact tag first (matches upstream resolve-version.sh precedence)
  base="$($SUDO git -C "$SRC_DIR" describe --tags --exact-match 2>/dev/null | sed 's/^v//' || true)"
  if [ -z "$base" ] && [ -f "$SRC_DIR/backend/cmd/server/VERSION" ]; then
    base="$($SUDO tr -d '\r\n' < "$SRC_DIR/backend/cmd/server/VERSION")"
  fi
  [ -n "$base" ] || base="0.0.0"
  VERSION_LABEL="${base}-burntoken"
}

build_image() {
  IMAGE_TAG="${IMAGE_REPO}:custom-${GIT_SHORT}"
  if [ "$NO_BUILD" = "1" ]; then
    if dk image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
      log "--no-build: reusing existing image ${IMAGE_TAG}"
    else
      die "--no-build set but image ${IMAGE_TAG} not found"
    fi
    return
  fi
  log "building ${IMAGE_TAG}  (VERSION=${VERSION_LABEL}, COMMIT=${GIT_SHORT})"
  dk build \
    --build-arg "VERSION=${VERSION_LABEL}" \
    --build-arg "COMMIT=${GIT_SHORT}" \
    --build-arg "DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --build-arg "GOPROXY=${GOPROXY_VAL}" \
    --build-arg "GOSUMDB=${GOSUMDB_VAL}" \
    -t "$IMAGE_TAG" -t "$LATEST_TAG" \
    "$SRC_DIR"
  ok "image built and tagged ${IMAGE_TAG} (+ ${LATEST_TAG})"
}

backup_db() {
  local ts dumpfile
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  dumpfile="${BACKUP_DIR}/db-pre-${TARGET_COLOR}-${ts}.dump"
  $SUDO mkdir -p "$BACKUP_DIR"
  log "pg_dump shared DB -> ${dumpfile}"
  # run pg_dump inside the postgres container so creds never leave it
  if dk exec "$PG_CONTAINER" sh -c \
       'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
       2>/dev/null | $SUDO tee "$dumpfile" >/dev/null; then
    ok "DB backup written ($($SUDO du -h "$dumpfile" | cut -f1))"
  else
    die "pg_dump failed; aborting before touching the target color"
  fi
}

export_env_from_live() {
  # Export the live container's runtime env into an env-file the target reuses,
  # guaranteeing identical DB/redis creds + all config. Drop only per-instance
  # overrides (we re-set SERVER_PORT). File is chmod 600 (holds secrets).
  local envfile="${DEPLOY_DIR}/${TARGET_COLOR}.env"
  log "exporting runtime env from live '${LIVE_NAME}' -> ${envfile}"
  dk inspect "$LIVE_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -vE '^(SERVER_PORT|HOSTNAME|PATH|HOME)=' \
    | $SUDO tee "$envfile" >/dev/null
  $SUDO chmod 600 "$envfile"
  TARGET_ENV_FILE="$envfile"
  ok "env exported ($( $SUDO wc -l < "$envfile" ) keys, mode 600)"
}

prepare_target_data() {
  log "preparing ${TARGET_COLOR} data dir: copy ${LIVE_DATA} -> ${TARGET_DATA}"
  if [ -d "$TARGET_DATA" ]; then
    warn "target data dir ${TARGET_DATA} already exists; replacing with fresh copy of live data"
    $SUDO rm -rf -- "$TARGET_DATA"
  fi
  $SUDO cp -a "$LIVE_DATA" "$TARGET_DATA"
  ok "data dir ready: ${TARGET_DATA}"
}

start_target_container() {
  log "starting ${TARGET_COLOR} container '${TARGET_NAME}' on :${TARGET_PORT}"
  if container_exists "$TARGET_NAME"; then
    warn "removing stale container '${TARGET_NAME}'"
    dk rm -f "$TARGET_NAME" >/dev/null 2>&1 || true
  fi
  dk run -d \
    --name "$TARGET_NAME" \
    --network "$DOCKER_NETWORK" \
    --env-file "$TARGET_ENV_FILE" \
    -e "SERVER_PORT=${CONTAINER_PORT}" \
    -p "127.0.0.1:${TARGET_PORT}:${CONTAINER_PORT}" \
    -v "${TARGET_DATA}:/app/data:Z" \
    --restart unless-stopped \
    --health-cmd "wget -q -T 5 -O /dev/null http://localhost:${CONTAINER_PORT}/health || exit 1" \
    --health-interval 10s \
    --health-timeout 5s \
    --health-start-period 30s \
    --health-retries 5 \
    "$IMAGE_TAG" >/dev/null
  ok "container '${TARGET_NAME}' started"
}

wait_healthy() {
  local name="$1" timeout="${2:-120}" waited=0
  log "waiting for '${name}' to become healthy (timeout ${timeout}s)"
  while [ "$waited" -lt "$timeout" ]; do
    local h; h="$(container_health "$name")"
    case "$h" in
      healthy) ok "'${name}' is healthy (${waited}s)"; return 0;;
      unhealthy) err "'${name}' reported unhealthy"; return 1;;
    esac
    sleep 3; waited=$((waited+3))
    printf '%s  ...%ss (%s)%s\r' "$C_DIM" "$waited" "$h" "$C_RESET"
  done
  printf '\n'; err "timed out waiting for '${name}' health"; return 1
}

verify_target() {
  local fail=0
  # 1) /health via port
  local hz; hz="$(curl -fsS --max-time 5 "http://127.0.0.1:${TARGET_PORT}/health" 2>/dev/null || echo '')"
  if printf '%s' "$hz" | grep -q '"status":"ok"'; then
    ok "health endpoint ok on :${TARGET_PORT}"
  else
    err "health endpoint NOT ok on :${TARGET_PORT} (got: ${hz:-empty})"; fail=1
  fi
  # 2) binary --version contains expected label
  local ver; ver="$(dk exec "$TARGET_NAME" /app/sub2api --version 2>/dev/null | grep -oE 'Sub2API [0-9][^ ]*' | head -1 || echo '')"
  if printf '%s' "$ver" | grep -q "$VERSION_LABEL"; then
    ok "version check ok: ${ver}"
  else
    warn "version string '${ver}' does not contain expected label '${VERSION_LABEL}'"
  fi
  # 3) frontend bundle differs from the live one (proves FE updated)
  local new_b old_b
  new_b="$(bundle_hash "$TARGET_PORT")"
  old_b="$(bundle_hash "$LIVE_PORT")"
  log "bundle: live(${LIVE_PORT})=${old_b}  target(${TARGET_PORT})=${new_b}"
  if [ "$new_b" = "-" ]; then
    err "could not read target bundle"; fail=1
  elif [ "$new_b" = "$old_b" ]; then
    warn "target bundle identical to live (frontend unchanged; may be expected if no FE diff)"
  else
    ok "frontend bundle changed (${old_b} -> ${new_b})"
  fi
  return $fail
}

cmd_deploy() {
  resolve_colors
  log "live=${LIVE_COLOR}(${LIVE_NAME}:${LIVE_PORT})  ->  target=${TARGET_COLOR}(${TARGET_NAME}:${TARGET_PORT})"
  confirm "Proceed with blue-green deploy to ${TARGET_COLOR}?" || die "aborted by user"

  sync_source
  resolve_version_label
  log "version label: ${VERSION_LABEL}"
  build_image
  backup_db
  export_env_from_live
  prepare_target_data
  start_target_container

  if ! wait_healthy "$TARGET_NAME" 150; then
    err "target '${TARGET_NAME}' failed health check. nginx NOT touched (still on :${LIVE_PORT})."
    err "Troubleshoot with:"
    err "  sudo docker logs --tail 100 ${TARGET_NAME}"
    err "  sudo docker inspect ${TARGET_NAME} --format '{{json .State.Health}}' | jq"
    err "  sudo docker exec ${TARGET_NAME} /app/sub2api --version"
    die "deploy aborted; live traffic unaffected"
  fi

  if ! verify_target; then
    err "verification failed. nginx NOT switched (still on :${LIVE_PORT})."
    err "Inspect target on :${TARGET_PORT}, then re-run or 'cleanup' the target."
    die "deploy aborted after health but before nginx flip; live traffic unaffected"
  fi

  log "flipping nginx to ${TARGET_COLOR} (:${TARGET_PORT})"
  switch_nginx "$LIVE_PORT" "$TARGET_PORT"
  sleep 1

  local pub; pub="$(curl -fsS --max-time 8 "${PUBLIC_URL}/health" 2>/dev/null || echo 'unreachable')"
  local pub_b; pub_b="$(curl -fsS --max-time 8 "${PUBLIC_URL}/" 2>/dev/null | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1 || echo '-')"
  hr
  ok "DEPLOY COMPLETE"
  log "live now : ${TARGET_COLOR} (${TARGET_NAME}) :${TARGET_PORT}"
  log "${PUBLIC_URL}/health -> ${pub}"
  log "${PUBLIC_URL} bundle -> ${pub_b}"
  log "old color '${LIVE_NAME}' (:${LIVE_PORT}) kept running for rollback."
  log "  rollback: $0 rollback"
  log "  cleanup : $0 cleanup   (after you confirm the new version is stable)"
  hr
}

# ------------------------------------------------------------------ main ----
main() {
  parse_args "$@"
  command -v docker >/dev/null 2>&1 || die "docker not found on PATH"
  case "$CMD" in
    deploy)   cmd_deploy;;
    rollback) cmd_rollback;;
    status)   cmd_status;;
    cleanup)  cmd_cleanup;;
    *) die "unknown subcommand: $CMD (use deploy|rollback|status|cleanup)";;
  esac
}
main "$@"
