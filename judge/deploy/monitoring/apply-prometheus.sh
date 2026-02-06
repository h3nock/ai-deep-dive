#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

PROMETHEUS_CONFIG_PATH=${PROMETHEUS_CONFIG_PATH:-/etc/prometheus/prometheus.yml}
PROMETHEUS_RULES_DIR=${PROMETHEUS_RULES_DIR:-/etc/prometheus/rules}
PROMETHEUS_RULES_PATH="$PROMETHEUS_RULES_DIR/judge-alerts.yml"
PROMETHEUS_CONFIG_DIR=$(dirname "$PROMETHEUS_CONFIG_PATH")

SCRAPE_INTERVAL=${SCRAPE_INTERVAL:-15s}
EVALUATION_INTERVAL=${EVALUATION_INTERVAL:-15s}

PROMETHEUS_TARGETS=${PROMETHEUS_TARGETS:-127.0.0.1:9090}
JUDGE_API_TARGETS=${JUDGE_API_TARGETS:-127.0.0.1:8000}
NODE_EXPORTER_TARGETS=${NODE_EXPORTER_TARGETS:-127.0.0.1:9100}

JUDGE_API_SCHEME=${JUDGE_API_SCHEME:-http}
JUDGE_API_METRICS_PATH=${JUDGE_API_METRICS_PATH:-/metrics}

if [[ ! -f "$SCRIPT_DIR/prometheus.yml.template" ]]; then
  echo "Missing template file: $SCRIPT_DIR/prometheus.yml.template" >&2
  exit 1
fi
if [[ ! -f "$SCRIPT_DIR/judge-alerts.yml" ]]; then
  echo "Missing alerts file: $SCRIPT_DIR/judge-alerts.yml" >&2
  exit 1
fi

build_targets_block() {
  local csv="$1"
  local target
  local block=""
  local -a raw_targets

  IFS=',' read -r -a raw_targets <<< "$csv"
  for target in "${raw_targets[@]}"; do
    target="${target#"${target%%[![:space:]]*}"}"
    target="${target%"${target##*[![:space:]]}"}"
    if [[ -n "$target" ]]; then
      block+="          - \"$target\"\n"
    fi
  done

  if [[ -z "$block" ]]; then
    echo "No targets provided in: $csv" >&2
    exit 1
  fi

  printf '%b' "$block"
}

PROMETHEUS_TARGETS_BLOCK=$(build_targets_block "$PROMETHEUS_TARGETS")
JUDGE_API_TARGETS_BLOCK=$(build_targets_block "$JUDGE_API_TARGETS")
NODE_EXPORTER_TARGETS_BLOCK=$(build_targets_block "$NODE_EXPORTER_TARGETS")

tmp_config=$(mktemp)
trap 'rm -f "$tmp_config"' EXIT

awk \
  -v scrape_interval="$SCRAPE_INTERVAL" \
  -v evaluation_interval="$EVALUATION_INTERVAL" \
  -v prometheus_rules_path="$PROMETHEUS_RULES_PATH" \
  -v judge_api_scheme="$JUDGE_API_SCHEME" \
  -v judge_api_metrics_path="$JUDGE_API_METRICS_PATH" \
  -v prometheus_targets_block="$PROMETHEUS_TARGETS_BLOCK" \
  -v judge_api_targets_block="$JUDGE_API_TARGETS_BLOCK" \
  -v node_exporter_targets_block="$NODE_EXPORTER_TARGETS_BLOCK" \
  '
  $0 == "__PROMETHEUS_TARGETS_BLOCK__" { printf "%s", prometheus_targets_block; next }
  $0 == "__JUDGE_API_TARGETS_BLOCK__" { printf "%s", judge_api_targets_block; next }
  $0 == "__NODE_EXPORTER_TARGETS_BLOCK__" { printf "%s", node_exporter_targets_block; next }
  {
    gsub("__SCRAPE_INTERVAL__", scrape_interval)
    gsub("__EVALUATION_INTERVAL__", evaluation_interval)
    gsub("__PROMETHEUS_RULES_PATH__", prometheus_rules_path)
    gsub("__JUDGE_API_SCHEME__", judge_api_scheme)
    gsub("__JUDGE_API_METRICS_PATH__", judge_api_metrics_path)
    print
  }
  ' "$SCRIPT_DIR/prometheus.yml.template" > "$tmp_config"

if command -v promtool >/dev/null 2>&1; then
  promtool check rules "$SCRIPT_DIR/judge-alerts.yml"
else
  echo "promtool not found; skipped Prometheus validation." >&2
fi

mkdir -p "$PROMETHEUS_CONFIG_DIR"
mkdir -p "$PROMETHEUS_RULES_DIR"
install -m 644 "$SCRIPT_DIR/judge-alerts.yml" "$PROMETHEUS_RULES_PATH"

if command -v promtool >/dev/null 2>&1; then
  promtool check config "$tmp_config"
fi

install -m 644 "$tmp_config" "$PROMETHEUS_CONFIG_PATH"

systemctl enable --now prometheus
systemctl restart prometheus

echo "Applied Prometheus config: $PROMETHEUS_CONFIG_PATH"
echo "Applied alert rules: $PROMETHEUS_RULES_PATH"
echo "Prometheus service restarted."
