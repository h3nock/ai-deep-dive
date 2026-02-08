#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

if [[ ! -f "$SCRIPT_DIR/alertmanager.yml.template" ]]; then
  echo "Missing template file: $SCRIPT_DIR/alertmanager.yml.template" >&2
  exit 1
fi

ALERTMANAGER_ENV_FILE=${ALERTMANAGER_ENV_FILE:-/etc/judge/alertmanager.env}
if [[ -f "$ALERTMANAGER_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ALERTMANAGER_ENV_FILE"
  set +a
fi

ALERTMANAGER_SERVICE=${ALERTMANAGER_SERVICE:-}
if [[ -z "$ALERTMANAGER_SERVICE" ]]; then
  if systemctl list-unit-files --type=service | grep -q '^prometheus-alertmanager\.service'; then
    ALERTMANAGER_SERVICE=prometheus-alertmanager
  elif systemctl list-unit-files --type=service | grep -q '^alertmanager\.service'; then
    ALERTMANAGER_SERVICE=alertmanager
  else
    echo "Could not find alertmanager service (prometheus-alertmanager or alertmanager)." >&2
    exit 1
  fi
fi

ALERTMANAGER_CONFIG_PATH=${ALERTMANAGER_CONFIG_PATH:-}
if [[ -z "$ALERTMANAGER_CONFIG_PATH" ]]; then
  ALERTMANAGER_CONFIG_PATH=$(systemctl cat "$ALERTMANAGER_SERVICE" 2>/dev/null | sed -n 's/.*--config\.file=\([^[:space:]]\+\).*/\1/p' | tail -n 1)
fi
if [[ -z "$ALERTMANAGER_CONFIG_PATH" ]]; then
  ALERTMANAGER_CONFIG_PATH=$(systemctl cat "$ALERTMANAGER_SERVICE" 2>/dev/null | sed -n 's/.*--config\.file[[:space:]]\([^[:space:]]\+\).*/\1/p' | tail -n 1)
fi
if [[ -z "$ALERTMANAGER_CONFIG_PATH" ]]; then
  ALERTMANAGER_CONFIG_PATH=/etc/prometheus/alertmanager.yml
fi
ALERTMANAGER_CONFIG_DIR=$(dirname "$ALERTMANAGER_CONFIG_PATH")
ALERTMANAGER_RUN_GROUP=""
ALERTMANAGER_RUN_GROUP=$(systemctl show -p Group --value "$ALERTMANAGER_SERVICE" 2>/dev/null || true)
if [[ -z "$ALERTMANAGER_RUN_GROUP" ]]; then
  ALERTMANAGER_RUN_USER=$(systemctl show -p User --value "$ALERTMANAGER_SERVICE" 2>/dev/null || true)
  if [[ -n "$ALERTMANAGER_RUN_USER" ]] && id "$ALERTMANAGER_RUN_USER" >/dev/null 2>&1; then
    ALERTMANAGER_RUN_GROUP=$(id -gn "$ALERTMANAGER_RUN_USER")
  fi
fi
ALERTMANAGER_WEB_LISTEN_ADDRESS=${ALERTMANAGER_WEB_LISTEN_ADDRESS:-127.0.0.1:9093}
ALERTMANAGER_CLUSTER_LISTEN_ADDRESS=${ALERTMANAGER_CLUSTER_LISTEN_ADDRESS:-}
ALERTMANAGER_STORAGE_PATH=${ALERTMANAGER_STORAGE_PATH:-/var/lib/prometheus/alertmanager}

ALERTMANAGER_SMTP_SMARTHOST=${ALERTMANAGER_SMTP_SMARTHOST:-}
ALERTMANAGER_SMTP_FROM=${ALERTMANAGER_SMTP_FROM:-}
ALERTMANAGER_SMTP_AUTH_USERNAME=${ALERTMANAGER_SMTP_AUTH_USERNAME:-}
ALERTMANAGER_SMTP_AUTH_PASSWORD=${ALERTMANAGER_SMTP_AUTH_PASSWORD:-}
ALERTMANAGER_SMTP_REQUIRE_TLS=${ALERTMANAGER_SMTP_REQUIRE_TLS:-true}

ALERTMANAGER_EMAIL_TO=${ALERTMANAGER_EMAIL_TO:-}
ALERTMANAGER_EMAIL_SEND_RESOLVED=${ALERTMANAGER_EMAIL_SEND_RESOLVED:-true}

ALERTMANAGER_TELEGRAM_BOT_TOKEN=${ALERTMANAGER_TELEGRAM_BOT_TOKEN:-}
ALERTMANAGER_TELEGRAM_CHAT_ID=${ALERTMANAGER_TELEGRAM_CHAT_ID:-}
ALERTMANAGER_TELEGRAM_SEND_RESOLVED=${ALERTMANAGER_TELEGRAM_SEND_RESOLVED:-true}

yaml_quote() {
  local value="$1"
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  printf '"%s"' "$value"
}

SMTP_GLOBAL_BLOCK=""
if [[ -n "$ALERTMANAGER_EMAIL_TO" ]]; then
  if [[ -z "$ALERTMANAGER_SMTP_SMARTHOST" || -z "$ALERTMANAGER_SMTP_FROM" ]]; then
    echo "ALERTMANAGER_EMAIL_TO requires ALERTMANAGER_SMTP_SMARTHOST and ALERTMANAGER_SMTP_FROM." >&2
    exit 1
  fi
  SMTP_GLOBAL_BLOCK+="  smtp_smarthost: $(yaml_quote "$ALERTMANAGER_SMTP_SMARTHOST")\n"
  SMTP_GLOBAL_BLOCK+="  smtp_from: $(yaml_quote "$ALERTMANAGER_SMTP_FROM")\n"
  if [[ -n "$ALERTMANAGER_SMTP_AUTH_USERNAME" ]]; then
    SMTP_GLOBAL_BLOCK+="  smtp_auth_username: $(yaml_quote "$ALERTMANAGER_SMTP_AUTH_USERNAME")\n"
  fi
  if [[ -n "$ALERTMANAGER_SMTP_AUTH_PASSWORD" ]]; then
    SMTP_GLOBAL_BLOCK+="  smtp_auth_password: $(yaml_quote "$ALERTMANAGER_SMTP_AUTH_PASSWORD")\n"
  fi
  SMTP_GLOBAL_BLOCK+="  smtp_require_tls: $ALERTMANAGER_SMTP_REQUIRE_TLS\n"
fi

EMAIL_CONFIG_BLOCK=""
if [[ -n "$ALERTMANAGER_EMAIL_TO" ]]; then
  EMAIL_CONFIG_BLOCK+="    email_configs:\n"
  EMAIL_CONFIG_BLOCK+="      - to: $(yaml_quote "$ALERTMANAGER_EMAIL_TO")\n"
  EMAIL_CONFIG_BLOCK+="        send_resolved: $ALERTMANAGER_EMAIL_SEND_RESOLVED\n"
fi

TELEGRAM_CONFIG_BLOCK=""
if [[ -n "$ALERTMANAGER_TELEGRAM_BOT_TOKEN" || -n "$ALERTMANAGER_TELEGRAM_CHAT_ID" ]]; then
  if [[ -z "$ALERTMANAGER_TELEGRAM_BOT_TOKEN" || -z "$ALERTMANAGER_TELEGRAM_CHAT_ID" ]]; then
    echo "Telegram requires both ALERTMANAGER_TELEGRAM_BOT_TOKEN and ALERTMANAGER_TELEGRAM_CHAT_ID." >&2
    exit 1
  fi
  if ! [[ "$ALERTMANAGER_TELEGRAM_CHAT_ID" =~ ^-?[0-9]+$ ]]; then
    echo "ALERTMANAGER_TELEGRAM_CHAT_ID must be a numeric chat ID." >&2
    exit 1
  fi
  TELEGRAM_CONFIG_BLOCK+="    telegram_configs:\n"
  TELEGRAM_CONFIG_BLOCK+="      - bot_token: $(yaml_quote "$ALERTMANAGER_TELEGRAM_BOT_TOKEN")\n"
  TELEGRAM_CONFIG_BLOCK+="        chat_id: $ALERTMANAGER_TELEGRAM_CHAT_ID\n"
  TELEGRAM_CONFIG_BLOCK+="        send_resolved: $ALERTMANAGER_TELEGRAM_SEND_RESOLVED\n"
fi

if [[ -z "$EMAIL_CONFIG_BLOCK" && -z "$TELEGRAM_CONFIG_BLOCK" ]]; then
  echo "Configure at least one receiver: email or telegram." >&2
  exit 1
fi

tmp_config=$(mktemp)
trap 'rm -f "$tmp_config"' EXIT

awk \
  -v smtp_global_block="$SMTP_GLOBAL_BLOCK" \
  -v email_config_block="$EMAIL_CONFIG_BLOCK" \
  -v telegram_config_block="$TELEGRAM_CONFIG_BLOCK" \
  '
  $0 == "__SMTP_GLOBAL_BLOCK__" { printf "%s", smtp_global_block; next }
  $0 == "__EMAIL_CONFIG_BLOCK__" { printf "%s", email_config_block; next }
  $0 == "__TELEGRAM_CONFIG_BLOCK__" { printf "%s", telegram_config_block; next }
  { print }
  ' "$SCRIPT_DIR/alertmanager.yml.template" > "$tmp_config"

if command -v amtool >/dev/null 2>&1; then
  amtool check-config "$tmp_config"
else
  echo "amtool not found; skipped Alertmanager config validation." >&2
fi

mkdir -p "$ALERTMANAGER_CONFIG_DIR"
if [[ -n "$ALERTMANAGER_RUN_GROUP" ]]; then
  install -m 640 -o root -g "$ALERTMANAGER_RUN_GROUP" "$tmp_config" "$ALERTMANAGER_CONFIG_PATH"
else
  install -m 640 "$tmp_config" "$ALERTMANAGER_CONFIG_PATH"
fi

# Ubuntu/Debian prometheus-alertmanager package reads ARGS from
# /etc/default/prometheus-alertmanager. Enforce single-node defaults here so
# startup does not fail when cluster advertise address auto-detection breaks.
if [[ "$ALERTMANAGER_SERVICE" == "prometheus-alertmanager" ]] && [[ -f /etc/default/prometheus-alertmanager ]]; then
  ALERTMANAGER_RUNTIME_ARGS="--config.file=$ALERTMANAGER_CONFIG_PATH --storage.path=$ALERTMANAGER_STORAGE_PATH --web.listen-address=$ALERTMANAGER_WEB_LISTEN_ADDRESS --cluster.listen-address=$ALERTMANAGER_CLUSTER_LISTEN_ADDRESS"
  if grep -q '^ARGS=' /etc/default/prometheus-alertmanager; then
    sed -i "s|^ARGS=.*|ARGS=\"$ALERTMANAGER_RUNTIME_ARGS\"|" /etc/default/prometheus-alertmanager
  else
    printf 'ARGS="%s"\n' "$ALERTMANAGER_RUNTIME_ARGS" >> /etc/default/prometheus-alertmanager
  fi
fi

systemctl enable --now "$ALERTMANAGER_SERVICE"
systemctl restart "$ALERTMANAGER_SERVICE"

echo "Applied Alertmanager config: $ALERTMANAGER_CONFIG_PATH"
echo "Alertmanager service restarted: $ALERTMANAGER_SERVICE"
