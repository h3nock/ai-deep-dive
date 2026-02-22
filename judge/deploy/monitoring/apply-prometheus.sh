#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
JUDGE_ENV_FILE=${JUDGE_ENV_FILE:-/etc/judge/judge.env}

if [[ -f "$JUDGE_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$JUDGE_ENV_FILE"
  set +a
fi

PROMETHEUS_CONFIG_PATH=${PROMETHEUS_CONFIG_PATH:-/etc/prometheus/prometheus.yml}
PROMETHEUS_RULES_DIR=${PROMETHEUS_RULES_DIR:-/etc/prometheus/rules}
PROMETHEUS_RULES_PATH="$PROMETHEUS_RULES_DIR/judge-alerts.yml"
PROMETHEUS_CONFIG_DIR=$(dirname "$PROMETHEUS_CONFIG_PATH")

SCRAPE_INTERVAL=${SCRAPE_INTERVAL:-15s}
EVALUATION_INTERVAL=${EVALUATION_INTERVAL:-15s}

PROMETHEUS_TARGETS=${PROMETHEUS_TARGETS:-127.0.0.1:9090}
JUDGE_API_TARGETS=${JUDGE_API_TARGETS:-127.0.0.1:8000}
NODE_EXPORTER_TARGETS=${NODE_EXPORTER_TARGETS:-127.0.0.1:9100}
ALERTMANAGER_TARGETS=${ALERTMANAGER_TARGETS:-127.0.0.1:9093}

JUDGE_API_SCHEME=${JUDGE_API_SCHEME:-http}
JUDGE_API_METRICS_PATH=${JUDGE_API_METRICS_PATH:-/metrics}

LIGHT_WORKERS=${ALERT_LIGHT_WORKERS:-${JUDGE_LIGHT_WORKERS:-1}}
TORCH_WORKERS=${ALERT_TORCH_WORKERS:-${JUDGE_TORCH_WORKERS:-1}}
ALERT_LIGHT_SEC_PER_JOB=${ALERT_LIGHT_SEC_PER_JOB:-0.146}
ALERT_TORCH_SEC_PER_JOB=${ALERT_TORCH_SEC_PER_JOB:-2.74}
ALERT_CAPACITY_SAFETY=${ALERT_CAPACITY_SAFETY:-0.8}
ALERT_BACKLOG_WARN_MINUTES=${ALERT_BACKLOG_WARN_MINUTES:-10}
ALERT_BACKLOG_FOR=${ALERT_BACKLOG_FOR:-15m}
ALERT_WORKER_HEALTH_FOR=${ALERT_WORKER_HEALTH_FOR:-3m}
ALERT_QUEUE_WAIT_WINDOW=${ALERT_QUEUE_WAIT_WINDOW:-10m}
ALERT_QUEUE_WAIT_P95_WARN_SECONDS=${ALERT_QUEUE_WAIT_P95_WARN_SECONDS:-60}
ALERT_QUEUE_WAIT_FOR=${ALERT_QUEUE_WAIT_FOR:-15m}
ALERT_QUEUE_WAIT_MIN_STARTS=${ALERT_QUEUE_WAIT_MIN_STARTS:-20}
ALERT_INTERNAL_ERROR_WINDOW_MINUTES=${ALERT_INTERNAL_ERROR_WINDOW_MINUTES:-10}
ALERT_INTERNAL_ERROR_RATE_THRESHOLD=${ALERT_INTERNAL_ERROR_RATE_THRESHOLD:-0.20}
ALERT_INTERNAL_ERROR_FOR=${ALERT_INTERNAL_ERROR_FOR:-15m}
ALERT_INTERNAL_ERROR_MIN_COMPLETIONS=${ALERT_INTERNAL_ERROR_MIN_COMPLETIONS:-20}

if [[ ! -f "$SCRIPT_DIR/prometheus.yml.template" ]]; then
  echo "Missing template file: $SCRIPT_DIR/prometheus.yml.template" >&2
  exit 1
fi
if [[ ! -f "$SCRIPT_DIR/judge-alerts.yml" ]]; then
  echo "Missing alerts template: $SCRIPT_DIR/judge-alerts.yml" >&2
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

is_number() {
  local value="$1"
  [[ "$value" =~ ^[0-9]+([.][0-9]+)?$ ]]
}

require_non_negative_int() {
  local name="$1"
  local value="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$name must be a non-negative integer (got: $value)" >&2
    exit 1
  fi
}

require_positive_number() {
  local name="$1"
  local value="$2"
  if is_number "$value" && awk -v x="$value" 'BEGIN { exit !(x > 0) }'; then
    return
  fi
  echo "$name must be a positive number (got: $value)" >&2
  exit 1
}

require_fraction() {
  local name="$1"
  local value="$2"
  if is_number "$value" && awk -v x="$value" 'BEGIN { exit !(x > 0 && x <= 1) }'; then
    return
  fi
  echo "$name must be in the range (0, 1] (got: $value)" >&2
  exit 1
}

ceil_number() {
  local value="$1"
  awk -v x="$value" '
    BEGIN {
      if (x <= 0) {
        print 0
      } else if (int(x) == x) {
        print int(x)
      } else {
        print int(x) + 1
      }
    }
  '
}

safe_throughput() {
  local workers="$1"
  local sec_per_job="$2"
  local safety="$3"
  awk -v w="$workers" -v s="$sec_per_job" -v a="$safety" '
    BEGIN {
      if (w <= 0 || s <= 0 || a <= 0) {
        print "0"
      } else {
        printf "%.10f", (w / s) * a
      }
    }
  '
}

require_non_negative_int "LIGHT_WORKERS" "$LIGHT_WORKERS"
require_non_negative_int "TORCH_WORKERS" "$TORCH_WORKERS"
require_positive_number "ALERT_LIGHT_SEC_PER_JOB" "$ALERT_LIGHT_SEC_PER_JOB"
require_positive_number "ALERT_TORCH_SEC_PER_JOB" "$ALERT_TORCH_SEC_PER_JOB"
require_fraction "ALERT_CAPACITY_SAFETY" "$ALERT_CAPACITY_SAFETY"
require_positive_number "ALERT_BACKLOG_WARN_MINUTES" "$ALERT_BACKLOG_WARN_MINUTES"
require_positive_number "ALERT_QUEUE_WAIT_P95_WARN_SECONDS" "$ALERT_QUEUE_WAIT_P95_WARN_SECONDS"
require_non_negative_int "ALERT_QUEUE_WAIT_MIN_STARTS" "$ALERT_QUEUE_WAIT_MIN_STARTS"
require_positive_number "ALERT_INTERNAL_ERROR_WINDOW_MINUTES" "$ALERT_INTERNAL_ERROR_WINDOW_MINUTES"
require_fraction "ALERT_INTERNAL_ERROR_RATE_THRESHOLD" "$ALERT_INTERNAL_ERROR_RATE_THRESHOLD"
require_non_negative_int "ALERT_INTERNAL_ERROR_MIN_COMPLETIONS" "$ALERT_INTERNAL_ERROR_MIN_COMPLETIONS"

LIGHT_SAFE_TPS=$(safe_throughput "$LIGHT_WORKERS" "$ALERT_LIGHT_SEC_PER_JOB" "$ALERT_CAPACITY_SAFETY")
TORCH_SAFE_TPS=$(safe_throughput "$TORCH_WORKERS" "$ALERT_TORCH_SEC_PER_JOB" "$ALERT_CAPACITY_SAFETY")

LIGHT_BACKLOG_WARN=$(ceil_number "$(awk -v t="$LIGHT_SAFE_TPS" -v m="$ALERT_BACKLOG_WARN_MINUTES" 'BEGIN { printf "%.10f", t * m * 60 }')")
TORCH_BACKLOG_WARN=$(ceil_number "$(awk -v t="$TORCH_SAFE_TPS" -v m="$ALERT_BACKLOG_WARN_MINUTES" 'BEGIN { printf "%.10f", t * m * 60 }')")

INTERNAL_ERROR_WINDOW="${ALERT_INTERNAL_ERROR_WINDOW_MINUTES}m"
INTERNAL_ERROR_MIN_COMPLETIONS="$ALERT_INTERNAL_ERROR_MIN_COMPLETIONS"

PROMETHEUS_TARGETS_BLOCK=$(build_targets_block "$PROMETHEUS_TARGETS")
JUDGE_API_TARGETS_BLOCK=$(build_targets_block "$JUDGE_API_TARGETS")
NODE_EXPORTER_TARGETS_BLOCK=$(build_targets_block "$NODE_EXPORTER_TARGETS")
ALERTMANAGER_TARGETS_BLOCK=$(build_targets_block "$ALERTMANAGER_TARGETS")

tmp_config=$(mktemp)
tmp_rules=$(mktemp)
trap 'rm -f "$tmp_config" "$tmp_rules"' EXIT

awk \
  -v scrape_interval="$SCRAPE_INTERVAL" \
  -v evaluation_interval="$EVALUATION_INTERVAL" \
  -v prometheus_rules_path="$PROMETHEUS_RULES_PATH" \
  -v judge_api_scheme="$JUDGE_API_SCHEME" \
  -v judge_api_metrics_path="$JUDGE_API_METRICS_PATH" \
  -v alertmanager_targets_block="$ALERTMANAGER_TARGETS_BLOCK" \
  -v prometheus_targets_block="$PROMETHEUS_TARGETS_BLOCK" \
  -v judge_api_targets_block="$JUDGE_API_TARGETS_BLOCK" \
  -v node_exporter_targets_block="$NODE_EXPORTER_TARGETS_BLOCK" \
  '
  $0 == "__ALERTMANAGER_TARGETS_BLOCK__" { printf "%s", alertmanager_targets_block; next }
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

awk \
  -v light_workers="$LIGHT_WORKERS" \
  -v torch_workers="$TORCH_WORKERS" \
  -v worker_health_for="$ALERT_WORKER_HEALTH_FOR" \
  -v light_backlog_warn="$LIGHT_BACKLOG_WARN" \
  -v torch_backlog_warn="$TORCH_BACKLOG_WARN" \
  -v backlog_warn_for="$ALERT_BACKLOG_FOR" \
  -v queue_wait_window="$ALERT_QUEUE_WAIT_WINDOW" \
  -v queue_wait_p95_warn_seconds="$ALERT_QUEUE_WAIT_P95_WARN_SECONDS" \
  -v queue_wait_min_starts="$ALERT_QUEUE_WAIT_MIN_STARTS" \
  -v queue_wait_for="$ALERT_QUEUE_WAIT_FOR" \
  -v internal_error_window="$INTERNAL_ERROR_WINDOW" \
  -v internal_error_rate_threshold="$ALERT_INTERNAL_ERROR_RATE_THRESHOLD" \
  -v internal_error_for="$ALERT_INTERNAL_ERROR_FOR" \
  -v internal_error_min_completions="$INTERNAL_ERROR_MIN_COMPLETIONS" \
  '
  {
    gsub("__LIGHT_WORKERS__", light_workers)
    gsub("__TORCH_WORKERS__", torch_workers)
    gsub("__WORKER_HEALTH_FOR__", worker_health_for)
    gsub("__LIGHT_BACKLOG_WARN__", light_backlog_warn)
    gsub("__TORCH_BACKLOG_WARN__", torch_backlog_warn)
    gsub("__BACKLOG_WARN_FOR__", backlog_warn_for)
    gsub("__QUEUE_WAIT_WINDOW__", queue_wait_window)
    gsub("__QUEUE_WAIT_P95_WARN_SECONDS__", queue_wait_p95_warn_seconds)
    gsub("__QUEUE_WAIT_MIN_STARTS__", queue_wait_min_starts)
    gsub("__QUEUE_WAIT_FOR__", queue_wait_for)
    gsub("__INTERNAL_ERROR_WINDOW__", internal_error_window)
    gsub("__INTERNAL_ERROR_RATE_THRESHOLD__", internal_error_rate_threshold)
    gsub("__INTERNAL_ERROR_FOR__", internal_error_for)
    gsub("__INTERNAL_ERROR_MIN_COMPLETIONS__", internal_error_min_completions)
    print
  }
  ' "$SCRIPT_DIR/judge-alerts.yml" > "$tmp_rules"

if grep -Eq '__[A-Z0-9_]+__' "$tmp_rules"; then
  echo "Failed to render one or more alert placeholders in $SCRIPT_DIR/judge-alerts.yml" >&2
  exit 1
fi

if command -v promtool >/dev/null 2>&1; then
  promtool check rules "$tmp_rules"
else
  echo "promtool not found; skipped Prometheus validation." >&2
fi

mkdir -p "$PROMETHEUS_CONFIG_DIR"
mkdir -p "$PROMETHEUS_RULES_DIR"
install -m 644 "$tmp_rules" "$PROMETHEUS_RULES_PATH"

if command -v promtool >/dev/null 2>&1; then
  promtool check config "$tmp_config"
fi

install -m 644 "$tmp_config" "$PROMETHEUS_CONFIG_PATH"

systemctl enable --now prometheus
systemctl restart prometheus

echo "Computed alert thresholds:"
echo "  Light workers: $LIGHT_WORKERS, safe throughput: $LIGHT_SAFE_TPS jobs/s, backlog warning: $LIGHT_BACKLOG_WARN"
echo "  Torch workers: $TORCH_WORKERS, safe throughput: $TORCH_SAFE_TPS jobs/s, backlog warning: $TORCH_BACKLOG_WARN"
echo "  Internal error min completions over ${INTERNAL_ERROR_WINDOW}: $INTERNAL_ERROR_MIN_COMPLETIONS"
echo "Applied Prometheus config: $PROMETHEUS_CONFIG_PATH"
echo "Applied alert rules: $PROMETHEUS_RULES_PATH"
echo "Prometheus service restarted."
