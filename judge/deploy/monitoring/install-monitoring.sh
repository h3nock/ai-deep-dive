#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "Missing /etc/os-release; cannot detect distro." >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "install-monitoring.sh currently supports Ubuntu only (detected: ${PRETTY_NAME:-unknown})." >&2
  echo "Install packages/repos manually on this distro, then run apply-prometheus.sh, apply-alertmanager.sh, and apply-grafana.sh." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y software-properties-common curl gpg

# prometheus-alertmanager lives in Ubuntu universe on some images.
add-apt-repository -y universe >/dev/null 2>&1 || true

apt-get update
apt-get install -y prometheus prometheus-node-exporter prometheus-alertmanager

install -d -m 0755 /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/grafana.gpg ]]; then
  curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
  chmod 0644 /etc/apt/keyrings/grafana.gpg
fi

cat > /etc/apt/sources.list.d/grafana.list <<'EOF'
deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main
EOF

apt-get update
apt-get install -y grafana

systemctl enable --now prometheus prometheus-node-exporter prometheus-alertmanager grafana-server

echo "Installed and enabled: prometheus, node-exporter, alertmanager, grafana."
