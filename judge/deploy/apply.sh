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

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

# Nginx rate limiting zones
install -m 644 "$ROOT_DIR/deploy/nginx/ratelimit.conf" /etc/nginx/conf.d/judge-ratelimit.conf

# Nginx site config
sed "s/\${JUDGE_DOMAIN}/$JUDGE_DOMAIN/g" \
  "$ROOT_DIR/deploy/nginx/judge.conf.template" \
  > /etc/nginx/sites-available/judge

ln -sf /etc/nginx/sites-available/judge /etc/nginx/sites-enabled/judge

nginx -t
systemctl reload nginx

# Systemd worker hardening
mkdir -p /etc/systemd/system/judge-worker-light.service.d
mkdir -p /etc/systemd/system/judge-worker-torch.service.d
install -m 644 "$ROOT_DIR/deploy/systemd/worker-override.conf" /etc/systemd/system/judge-worker-light.service.d/override.conf
install -m 644 "$ROOT_DIR/deploy/systemd/worker-override.conf" /etc/systemd/system/judge-worker-torch.service.d/override.conf

systemctl daemon-reload
systemctl restart judge-worker-light judge-worker-torch

echo "Applied nginx rate limits and worker hardening."
