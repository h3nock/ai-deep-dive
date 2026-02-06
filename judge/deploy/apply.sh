#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

JUDGE_DOMAIN=${JUDGE_DOMAIN:-}
if [[ -z "$JUDGE_DOMAIN" ]]; then
  echo "Set JUDGE_DOMAIN, e.g.:" >&2
  echo "  sudo JUDGE_DOMAIN=judge.h3nok.dev $0" >&2
  exit 1
fi

JUDGE_CERT_DIR=${JUDGE_CERT_DIR:-/etc/letsencrypt/live/$JUDGE_DOMAIN}
JUDGE_TESTS_ROOT=${JUDGE_TESTS_ROOT:-/opt/ai-deep-dive/judge/tests}

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

# Load /etc/judge/judge.env if present.
if [[ -f /etc/judge/judge.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/judge/judge.env
  set +a
fi

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

systemctl daemon-reload
systemctl restart judge-metrics-init
systemctl restart judge-api

for i in $(seq 1 "$LIGHT_COUNT"); do
  systemctl enable --now "judge-worker-light@${i}"
done

for i in $(seq 1 "$TORCH_COUNT"); do
  systemctl enable --now "judge-worker-torch@${i}"
done

# Stop legacy non-template services if they exist
systemctl disable --now judge-worker-light.service >/dev/null 2>&1 || true
systemctl disable --now judge-worker-torch.service >/dev/null 2>&1 || true

# Cleanup + backup timers
install -m 644 "$ROOT_DIR/deploy/judge-cleanup.service" /etc/systemd/system/judge-cleanup.service
install -m 644 "$ROOT_DIR/deploy/judge-cleanup.timer" /etc/systemd/system/judge-cleanup.timer
install -m 644 "$ROOT_DIR/deploy/judge-backup.service" /etc/systemd/system/judge-backup.service
install -m 644 "$ROOT_DIR/deploy/judge-backup.timer" /etc/systemd/system/judge-backup.timer

systemctl daemon-reload
systemctl enable --now judge-cleanup.timer
systemctl enable --now judge-backup.timer

echo "Applied nginx rate limits, worker templates, cleanup, and backups."
