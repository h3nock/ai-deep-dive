#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[fail] $1" >&2
  exit 1
}

info() {
  echo "[info] $1"
}

resolve_redis_service() {
  if systemctl list-unit-files --type=service --no-legend | awk '$1 == "redis-server.service" {found=1} END {exit(found ? 0 : 1)}'; then
    echo "redis-server.service"
    return
  fi
  if systemctl list-unit-files --type=service --no-legend | awk '$1 == "redis.service" && $2 != "alias" {found=1} END {exit(found ? 0 : 1)}'; then
    echo "redis.service"
    return
  fi
  fail "No usable Redis unit found (expected redis-server.service or redis.service)."
}

gpu_torch=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --gpu)
      gpu_torch=1
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
  shift
done

if [[ $(id -u) -ne 0 ]]; then
  fail "Please run as root (sudo)."
fi

if [[ ! -r /etc/os-release ]]; then
  fail "Missing /etc/os-release."
fi
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  fail "bootstrap.sh currently supports Ubuntu only (detected: ${PRETTY_NAME:-unknown})."
fi

if ! command -v systemctl >/dev/null 2>&1; then
  fail "systemd is required."
fi

JUDGE_DOMAIN=${JUDGE_DOMAIN:-}
if [[ -z "$JUDGE_DOMAIN" ]]; then
  fail "Set JUDGE_DOMAIN, e.g. sudo JUDGE_DOMAIN=judge.aideepdive.dev $0"
fi

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
REPO_DIR=$(cd "$ROOT_DIR/.." && pwd)
JUDGE_DIR="$REPO_DIR/judge"
ENV_FILE=/etc/judge/judge.env
JUDGE_USER=judge
VENV_DIR="$JUDGE_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"
created_env=0
use_uv=0

if [[ ! -f "$JUDGE_DIR/deploy/apply.sh" ]]; then
  fail "Missing $JUDGE_DIR/deploy/apply.sh. Run from a valid judge checkout."
fi

export DEBIAN_FRONTEND=noninteractive
info "Installing required system packages"
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  nginx \
  python3 \
  python3-pip \
  python3-venv \
  redis-server

if ! command -v isolate >/dev/null 2>&1; then
  if apt-cache show isolate >/dev/null 2>&1; then
    info "Installing isolate from apt"
    apt-get install -y isolate
  elif [[ -x /usr/local/bin/isolate ]]; then
    info "Using preinstalled isolate at /usr/local/bin/isolate"
  else
    fail "isolate binary not found and apt package is unavailable. Install isolate manually, then rerun bootstrap."
  fi
fi

if ! id "$JUDGE_USER" >/dev/null 2>&1; then
  info "Creating system user: $JUDGE_USER"
  adduser --system --group "$JUDGE_USER"
fi

mkdir -p /opt/ai-deep-dive
mkdir -p /etc/judge
chown "$JUDGE_USER:$JUDGE_USER" /opt/ai-deep-dive

if [[ ! -d "$REPO_DIR/.git" ]]; then
  repo_url=${JUDGE_REPO_URL:-}
  if [[ -z "$repo_url" ]]; then
    fail "Repository missing at $REPO_DIR. Set JUDGE_REPO_URL to bootstrap clone."
  fi
  if [[ -d "$REPO_DIR" ]] && [[ -n "$(find "$REPO_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null || true)" ]]; then
    fail "Refusing to clone into non-empty path without a git checkout: $REPO_DIR"
  fi
  info "Cloning repository into $REPO_DIR"
  rmdir "$REPO_DIR" >/dev/null 2>&1 || true
  sudo -u "$JUDGE_USER" git clone "$repo_url" "$REPO_DIR"
  chown -R "$JUDGE_USER:$JUDGE_USER" "$REPO_DIR"
fi

mkdir -p "$JUDGE_DIR/data"
chown -R "$JUDGE_USER:$JUDGE_USER" "$JUDGE_DIR/data"
if [[ -d "$VENV_DIR" ]]; then
  chown -R "$JUDGE_USER:$JUDGE_USER" "$VENV_DIR"
fi

if command -v uv >/dev/null 2>&1; then
  use_uv=1
  info "Using uv-managed virtualenv and package install"
else
  info "uv not found; falling back to python3 -m venv + pip"
fi

if [[ ! -x "$VENV_PY" ]]; then
  info "Creating Python virtual environment"
  if (( use_uv == 1 )); then
    sudo -u "$JUDGE_USER" uv venv "$VENV_DIR"
  else
    sudo -u "$JUDGE_USER" python3 -m venv "$VENV_DIR"
  fi
fi

pip_install() {
  if (( use_uv == 1 )); then
    sudo -u "$JUDGE_USER" uv pip install --python "$VENV_PY" "$@"
  else
    sudo -u "$JUDGE_USER" "$VENV_PIP" install "$@"
  fi
}

info "Installing judge dependencies"
pip_install --upgrade pip

if ! sudo -u "$JUDGE_USER" "$VENV_PY" -c "import torch" >/dev/null 2>&1; then
  if (( gpu_torch == 1 )); then
    info "Installing PyTorch (GPU/default wheels)"
    pip_install --upgrade "torch>=2.2,<3"
  else
    info "Installing PyTorch (CPU wheels)"
    pip_install --upgrade --index-url https://download.pytorch.org/whl/cpu "torch>=2.2,<3"
  fi
fi
pip_install -e "$JUDGE_DIR"

if [[ ! -f /etc/redis/redis.conf ]]; then
  fail "Missing /etc/redis/redis.conf after installing redis-server."
fi
ensure_redis_setting() {
  local key="$1"
  local value="$2"
  local config_file=/etc/redis/redis.conf
  if grep -Eq "^[#[:space:]]*${key}[[:space:]]+" "$config_file"; then
    sed -i -E "s|^[#[:space:]]*${key}[[:space:]].*|${key} ${value}|" "$config_file"
  else
    printf "%s %s\n" "$key" "$value" >> "$config_file"
  fi
}
ensure_redis_setting "appendonly" "yes"
ensure_redis_setting "appendfsync" "everysec"
ensure_redis_setting "maxmemory-policy" "noeviction"

redis_service=$(resolve_redis_service)
systemctl enable --now "$redis_service"

mkdir -p /var/local/lib/isolate
chown root:root /var/local/lib/isolate
chmod 0755 /var/local/lib/isolate

if [[ ! -f "$ENV_FILE" ]]; then
  info "Creating $ENV_FILE from judge.env.example"
  install -m 640 -o root -g root "$JUDGE_DIR/deploy/judge.env.example" "$ENV_FILE"
  created_env=1
else
  chown root:root "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

JUDGE_TESTS_ROOT=${JUDGE_TESTS_ROOT:-/opt/ai-deep-dive/judge/tests}
mkdir -p "$JUDGE_TESTS_ROOT"
chown -R "$JUDGE_USER:$JUDGE_USER" "$JUDGE_TESTS_ROOT"

info "Exporting judge tests bundle"
sudo -u "$JUDGE_USER" env PYTHONPATH="$JUDGE_DIR/src" "$VENV_PY" "$JUDGE_DIR/scripts/export_tests_endpoint.py" --out-root "$JUDGE_TESTS_ROOT"

info "Applying deploy configuration"
if [[ -n "${JUDGE_CERT_DIR:-}" ]]; then
  JUDGE_DOMAIN="$JUDGE_DOMAIN" JUDGE_CERT_DIR="$JUDGE_CERT_DIR" JUDGE_TESTS_ROOT="$JUDGE_TESTS_ROOT" "$JUDGE_DIR/deploy/apply.sh"
else
  JUDGE_DOMAIN="$JUDGE_DOMAIN" JUDGE_TESTS_ROOT="$JUDGE_TESTS_ROOT" "$JUDGE_DIR/deploy/apply.sh"
fi

info "Running deploy verification"
"$JUDGE_DIR/deploy/verify.sh"

if (( created_env == 1 )); then
  info "Review $ENV_FILE and rerun bootstrap if you changed values."
fi

echo "[ok] bootstrap completed"
