#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: update-vm.sh [--host SSH_TARGET] [--domain DOMAIN] [--ref GIT_REF] [--repo-dir PATH]

Defaults:
  --ref      origin/main
  --repo-dir /opt/ai-deep-dive

Required unless provided via environment:
  --host     or JUDGE_VM_HOST
  --domain   or JUDGE_DOMAIN
EOF
}

fail() {
  echo "$1" >&2
  exit 1
}

JUDGE_VM_HOST=${JUDGE_VM_HOST:-}
JUDGE_DOMAIN=${JUDGE_DOMAIN:-}
JUDGE_REF=${JUDGE_REF:-origin/main}
JUDGE_REPO_DIR=${JUDGE_REPO_DIR:-/opt/ai-deep-dive}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      [[ $# -ge 2 ]] || fail "--host requires a value"
      JUDGE_VM_HOST="$2"
      shift 2
      ;;
    --domain)
      [[ $# -ge 2 ]] || fail "--domain requires a value"
      JUDGE_DOMAIN="$2"
      shift 2
      ;;
    --ref)
      [[ $# -ge 2 ]] || fail "--ref requires a value"
      JUDGE_REF="$2"
      shift 2
      ;;
    --repo-dir)
      [[ $# -ge 2 ]] || fail "--repo-dir requires a value"
      JUDGE_REPO_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$JUDGE_VM_HOST" ]] || fail "Set --host or JUDGE_VM_HOST"
[[ -n "$JUDGE_DOMAIN" ]] || fail "Set --domain or JUDGE_DOMAIN"

echo "[info] deploying $JUDGE_REF to $JUDGE_VM_HOST"

ssh "$JUDGE_VM_HOST" \
  "JUDGE_DOMAIN=$(printf '%q' "$JUDGE_DOMAIN") JUDGE_REF=$(printf '%q' "$JUDGE_REF") JUDGE_REPO_DIR=$(printf '%q' "$JUDGE_REPO_DIR") bash -s" <<'REMOTE'
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "Please connect as root so deploy scripts can run sudo/systemctl." >&2
  exit 1
fi

if [[ -f /etc/judge/judge.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/judge/judge.env
  set +a
fi

JUDGE_TESTS_ROOT=${JUDGE_TESTS_ROOT:-$JUDGE_REPO_DIR/judge/tests}

cd "$JUDGE_REPO_DIR"
sudo -u judge git fetch --prune origin
resolved_ref=$(sudo -u judge git rev-parse "${JUDGE_REF}^{commit}")
echo "[remote] resolved ref: $resolved_ref"
sudo -u judge git reset --hard "$resolved_ref"
sudo -u judge git clean -fd

cd "$JUDGE_REPO_DIR/judge"
sudo -u judge env PYTHONPATH=src .venv/bin/python scripts/export_tests_endpoint.py --out-root "$JUDGE_TESTS_ROOT"
sudo JUDGE_DOMAIN="$JUDGE_DOMAIN" ./deploy/apply.sh
sudo ./deploy/verify.sh

cd "$JUDGE_REPO_DIR"
echo "[remote] deployed commit: $(git rev-parse HEAD)"
git status --short --branch
REMOTE
