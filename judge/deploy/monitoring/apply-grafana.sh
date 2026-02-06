#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

if [[ ! -f "$SCRIPT_DIR/grafana-datasource.yml.template" ]]; then
  echo "Missing template file: $SCRIPT_DIR/grafana-datasource.yml.template" >&2
  exit 1
fi
if [[ ! -f "$SCRIPT_DIR/grafana-dashboard-provider.yml.template" ]]; then
  echo "Missing template file: $SCRIPT_DIR/grafana-dashboard-provider.yml.template" >&2
  exit 1
fi
if [[ ! -f "$SCRIPT_DIR/grafana/judge-overview.json" ]]; then
  echo "Missing dashboard JSON: $SCRIPT_DIR/grafana/judge-overview.json" >&2
  exit 1
fi

GRAFANA_SERVICE=${GRAFANA_SERVICE:-grafana-server}
GRAFANA_PROMETHEUS_URL=${GRAFANA_PROMETHEUS_URL:-http://127.0.0.1:9090}
GRAFANA_DATASOURCE_PATH=${GRAFANA_DATASOURCE_PATH:-/etc/grafana/provisioning/datasources/judge-prometheus.yml}
GRAFANA_DASHBOARD_PROVIDER_PATH=${GRAFANA_DASHBOARD_PROVIDER_PATH:-/etc/grafana/provisioning/dashboards/judge-provider.yml}
GRAFANA_DASHBOARD_DIR=${GRAFANA_DASHBOARD_DIR:-/var/lib/grafana/dashboards}
GRAFANA_DASHBOARD_PATH="$GRAFANA_DASHBOARD_DIR/judge-overview.json"

if ! systemctl list-unit-files --type=service | grep -q "^${GRAFANA_SERVICE}\.service"; then
  echo "Could not find Grafana service: $GRAFANA_SERVICE" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool "$SCRIPT_DIR/grafana/judge-overview.json" >/dev/null
fi

tmp_datasource=$(mktemp)
tmp_provider=$(mktemp)
trap 'rm -f "$tmp_datasource" "$tmp_provider"' EXIT

awk \
  -v grafana_prometheus_url="$GRAFANA_PROMETHEUS_URL" \
  '
  {
    gsub("__GRAFANA_PROMETHEUS_URL__", grafana_prometheus_url)
    print
  }
  ' "$SCRIPT_DIR/grafana-datasource.yml.template" > "$tmp_datasource"

awk \
  -v grafana_dashboard_dir="$GRAFANA_DASHBOARD_DIR" \
  '
  {
    gsub("__GRAFANA_DASHBOARD_DIR__", grafana_dashboard_dir)
    print
  }
  ' "$SCRIPT_DIR/grafana-dashboard-provider.yml.template" > "$tmp_provider"

mkdir -p "$(dirname "$GRAFANA_DATASOURCE_PATH")"
mkdir -p "$(dirname "$GRAFANA_DASHBOARD_PROVIDER_PATH")"
mkdir -p "$GRAFANA_DASHBOARD_DIR"

install -m 644 "$tmp_datasource" "$GRAFANA_DATASOURCE_PATH"
install -m 644 "$tmp_provider" "$GRAFANA_DASHBOARD_PROVIDER_PATH"
install -m 644 "$SCRIPT_DIR/grafana/judge-overview.json" "$GRAFANA_DASHBOARD_PATH"

systemctl enable --now "$GRAFANA_SERVICE"
systemctl restart "$GRAFANA_SERVICE"

echo "Applied Grafana datasource: $GRAFANA_DATASOURCE_PATH"
echo "Applied Grafana dashboard provider: $GRAFANA_DASHBOARD_PROVIDER_PATH"
echo "Installed Grafana dashboard: $GRAFANA_DASHBOARD_PATH"
echo "Grafana service restarted: $GRAFANA_SERVICE"
