#!/usr/bin/env bash
set -euo pipefail

ALERTMANAGER_URL=${ALERTMANAGER_URL:-http://127.0.0.1:9093}
ALERT_NAME=${ALERT_NAME:-JudgeManualAlertTest}
ALERT_SEVERITY=${ALERT_SEVERITY:-info}
ALERT_DURATION_MINUTES=${ALERT_DURATION_MINUTES:-10}

starts_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ends_at=$(date -u -d "+${ALERT_DURATION_MINUTES} minutes" +"%Y-%m-%dT%H:%M:%SZ")

payload=$(cat <<EOF
[
  {
    "labels": {
      "alertname": "$ALERT_NAME",
      "severity": "$ALERT_SEVERITY",
      "source": "manual"
    },
    "annotations": {
      "summary": "Manual Alertmanager test",
      "description": "Testing Alertmanager notification pipeline."
    },
    "startsAt": "$starts_at",
    "endsAt": "$ends_at"
  }
]
EOF
)

curl -fsS \
  -H "Content-Type: application/json" \
  -X POST \
  "$ALERTMANAGER_URL/api/v2/alerts" \
  -d "$payload" >/dev/null

echo "Injected test alert '$ALERT_NAME' to $ALERTMANAGER_URL for ${ALERT_DURATION_MINUTES} minute(s)."
