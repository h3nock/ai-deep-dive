#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

JUDGE_DOMAIN=${JUDGE_DOMAIN:-}
if [[ -z "$JUDGE_DOMAIN" ]]; then
  echo "Set JUDGE_DOMAIN, e.g.:" >&2
  echo "  sudo JUDGE_DOMAIN=judge.aideepdive.dev $0" >&2
  exit 1
fi

JUDGE_CERT_DIR=${JUDGE_CERT_DIR:-/etc/letsencrypt/live/$JUDGE_DOMAIN}
JUDGE_TESTS_ROOT=${JUDGE_TESTS_ROOT:-/opt/ai-deep-dive/judge/tests}

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
JUDGE_USER=${JUDGE_USER:-judge}

validate_non_negative_int() {
  local value="$1"
  local key="$2"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    echo "$key must be a non-negative integer (got: $value)." >&2
    exit 1
  fi
}

reconcile_worker_units() {
  local prefix="$1"
  local desired="$2"
  local unit
  local index
  local -a known_units=()
  local -a active_units=()

  mapfile -t known_units < <(systemctl list-unit-files "${prefix}@*.service" --no-legend --no-pager 2>/dev/null | awk '{print $1}')
  mapfile -t active_units < <(systemctl list-units --type=service --state=active --plain --no-legend "${prefix}@*.service" 2>/dev/null | awk '{print $1}')

  for unit in "${known_units[@]}"; do
    [[ -z "$unit" ]] && continue
    if [[ "$unit" =~ ^${prefix}@([0-9]+)\.service$ ]]; then
      index=${BASH_REMATCH[1]}
      if (( index > desired )); then
        systemctl disable --now "$unit" >/dev/null 2>&1 || true
      fi
    fi
  done
  for unit in "${active_units[@]}"; do
    [[ -z "$unit" ]] && continue
    if [[ "$unit" =~ ^${prefix}@([0-9]+)\.service$ ]]; then
      index=${BASH_REMATCH[1]}
      if (( index > desired )); then
        systemctl disable --now "$unit" >/dev/null 2>&1 || true
      fi
    fi
  done

  if (( desired == 0 )); then
    return
  fi

  for index in $(seq 1 "$desired"); do
    unit="${prefix}@${index}.service"
    systemctl enable "$unit" >/dev/null
    systemctl restart "$unit"
  done
}

pip_install_for_judge() {
  local venv_python="$1"
  shift
  local venv_pip
  venv_pip="$(dirname "$venv_python")/pip"

  if command -v uv >/dev/null 2>&1; then
    sudo -u "$JUDGE_USER" uv pip install --python "$venv_python" "$@"
    return
  fi

  if [[ ! -x "$venv_pip" ]]; then
    echo "pip not found for judge interpreter: $venv_pip" >&2
    exit 1
  fi
  sudo -u "$JUDGE_USER" "$venv_pip" install "$@"
}

torch_variant_for_judge() {
  local venv_python="$1"
  sudo -u "$JUDGE_USER" "$venv_python" - <<'PY'
import importlib.util

if importlib.util.find_spec("torch") is None:
    print("missing")
    raise SystemExit(0)

try:
    import torch
except Exception:
    print("broken")
    raise SystemExit(0)

print("cuda" if getattr(torch.version, "cuda", None) else "cpu")
PY
}

ensure_cpu_torch_for_judge() {
  local venv_python="$1"
  if [[ ! -x "$venv_python" ]]; then
    echo "Judge python interpreter not found: $venv_python" >&2
    exit 1
  fi

  local variant
  variant=$(torch_variant_for_judge "$venv_python")
  if [[ "$variant" == "cpu" ]]; then
    echo "PyTorch CPU wheel already installed."
    return
  fi

  if [[ "$variant" == "cuda" ]]; then
    echo "Replacing CUDA PyTorch wheel with CPU-only wheel." >&2
  else
    echo "Installing PyTorch CPU wheel." >&2
  fi

  pip_install_for_judge "$venv_python" --upgrade --force-reinstall --index-url https://download.pytorch.org/whl/cpu "torch>=2.2,<3"
  variant=$(torch_variant_for_judge "$venv_python")
  if [[ "$variant" != "cpu" ]]; then
    echo "Failed to enforce CPU-only PyTorch (detected: $variant)." >&2
    exit 1
  fi
}

# Load /etc/judge/judge.env if present.
if [[ -f /etc/judge/judge.env ]]; then
  chown root:root /etc/judge/judge.env
  chmod 0640 /etc/judge/judge.env
  set -a
  # shellcheck disable=SC1091
  source /etc/judge/judge.env
  set +a
fi

JUDGE_PYTHON_BIN=${JUDGE_PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}
ensure_cpu_torch_for_judge "$JUDGE_PYTHON_BIN"

if [[ -z "${PROMETHEUS_MULTIPROC_DIR+x}" ]]; then
  PROMETHEUS_MULTIPROC_DIR=/var/lib/judge/prometheus-multiproc
fi
if [[ -n "$PROMETHEUS_MULTIPROC_DIR" ]]; then
  mkdir -p "$PROMETHEUS_MULTIPROC_DIR"
  chown judge:judge "$PROMETHEUS_MULTIPROC_DIR"
fi

mkdir -p /var/local/lib/isolate
chown root:root /var/local/lib/isolate
chmod 0755 /var/local/lib/isolate

mkdir -p "$JUDGE_TESTS_ROOT"
chown -R judge:judge "$JUDGE_TESTS_ROOT"

# API service (binds locally)
install -m 644 "$ROOT_DIR/deploy/judge-api.service" /etc/systemd/system/judge-api.service
install -m 644 "$ROOT_DIR/deploy/judge-metrics-init.service" /etc/systemd/system/judge-metrics-init.service

# Nginx rate limiting zones
install -m 644 "$ROOT_DIR/deploy/nginx/ratelimit.conf" /etc/nginx/conf.d/judge-ratelimit.conf
# Cloudflare real IP restore (safe even if not using Cloudflare)
install -m 644 "$ROOT_DIR/deploy/nginx/cloudflare-realip.conf" /etc/nginx/conf.d/judge-cloudflare-realip.conf

# Nginx site config
NGINX_TEMPLATE="$ROOT_DIR/deploy/nginx/judge.http.conf.template"
if [[ -f "$JUDGE_CERT_DIR/fullchain.pem" && -f "$JUDGE_CERT_DIR/privkey.pem" ]]; then
  NGINX_TEMPLATE="$ROOT_DIR/deploy/nginx/judge.https.conf.template"
else
  echo "TLS certs not found at $JUDGE_CERT_DIR, using HTTP-only config." >&2
fi

sed -e "s|\${JUDGE_DOMAIN}|$JUDGE_DOMAIN|g" \
  -e "s|\${JUDGE_CERT_DIR}|$JUDGE_CERT_DIR|g" \
  -e "s|\${JUDGE_TESTS_ROOT}|$JUDGE_TESTS_ROOT|g" \
  "$NGINX_TEMPLATE" \
  > /etc/nginx/sites-available/judge

ln -sf /etc/nginx/sites-available/judge /etc/nginx/sites-enabled/judge

nginx -t
systemctl reload nginx

# Systemd worker units + hardening
install -m 644 "$ROOT_DIR/deploy/judge-worker-light@.service" /etc/systemd/system/judge-worker-light@.service
install -m 644 "$ROOT_DIR/deploy/judge-worker-torch@.service" /etc/systemd/system/judge-worker-torch@.service

mkdir -p /etc/systemd/system/judge-worker-light@.service.d
mkdir -p /etc/systemd/system/judge-worker-torch@.service.d
install -m 644 "$ROOT_DIR/deploy/systemd/worker-override.conf" /etc/systemd/system/judge-worker-light@.service.d/override.conf
install -m 644 "$ROOT_DIR/deploy/systemd/worker-override.conf" /etc/systemd/system/judge-worker-torch@.service.d/override.conf

LIGHT_COUNT=${JUDGE_LIGHT_WORKERS:-1}
TORCH_COUNT=${JUDGE_TORCH_WORKERS:-1}
validate_non_negative_int "$LIGHT_COUNT" "JUDGE_LIGHT_WORKERS"
validate_non_negative_int "$TORCH_COUNT" "JUDGE_TORCH_WORKERS"

systemctl daemon-reload
systemctl restart judge-metrics-init.service
systemctl enable judge-api.service >/dev/null
systemctl restart judge-api.service

# Stop legacy non-template services to avoid mixed worker models.
systemctl disable --now judge-worker-light.service >/dev/null 2>&1 || true
systemctl disable --now judge-worker-torch.service >/dev/null 2>&1 || true

reconcile_worker_units "judge-worker-light" "$LIGHT_COUNT"
reconcile_worker_units "judge-worker-torch" "$TORCH_COUNT"

# Cleanup + backup timers
install -m 644 "$ROOT_DIR/deploy/judge-cleanup.service" /etc/systemd/system/judge-cleanup.service
install -m 644 "$ROOT_DIR/deploy/judge-cleanup.timer" /etc/systemd/system/judge-cleanup.timer
install -m 644 "$ROOT_DIR/deploy/judge-backup.service" /etc/systemd/system/judge-backup.service
install -m 644 "$ROOT_DIR/deploy/judge-backup.timer" /etc/systemd/system/judge-backup.timer

systemctl daemon-reload
systemctl enable --now judge-cleanup.timer
systemctl enable --now judge-backup.timer

echo "Applied nginx rate limits, worker templates, cleanup, and backups."
