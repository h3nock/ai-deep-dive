# VM deployment (single VM)

Minimal systemd setup for an Ubuntu VM.

## 1) Create user + folders

```bash
sudo adduser --system --group judge
sudo mkdir -p /opt/ai-deep-dive
sudo mkdir -p /etc/judge
sudo chown -R judge:judge /opt/ai-deep-dive
```

## 2) Copy repo and create venv (uv)

Install `uv` on the VM first if it is not already available.

```bash
# clone repo into /opt/ai-deep-dive
sudo -u judge git clone <your-repo-url> /opt/ai-deep-dive
cd /opt/ai-deep-dive/judge
uv venv .venv
source .venv/bin/activate
uv pip install -e .
```

CPU-only PyTorch is required to run torch problems on the VM. Install it in
the same venv using the official PyTorch install selector.

## 3) Export tests endpoint

Public bundles are served from `/judge-tests/` on the judge domain. Hidden
tests are exported to the same root for server-side judge execution but are not
publicly served (`hidden_tests.json` returns `404`). Export assets into the
tests root:

```bash
cd /opt/ai-deep-dive/judge
python judge/scripts/export_tests_endpoint.py --out-root /opt/ai-deep-dive/judge/tests
```

Re-run this after updating `judge/problems`.

## 4) Configure environment

```bash
sudo cp judge/deploy/judge.env.example /etc/judge/judge.env
sudo chown judge:judge /etc/judge/judge.env
```

Set `JUDGE_ALLOWED_ORIGINS` when the web app is hosted on a different origin.

## 5) Install and start Redis

```bash
sudo apt-get update
sudo apt-get install -y redis-server
```

Recommended Redis config (edit `/etc/redis/redis.conf`):

```
appendonly yes
appendfsync everysec
maxmemory-policy noeviction
```

## 6) Isolate sandbox

Install isolate (Ubuntu):

```bash
sudo apt-get install -y isolate
sudo mkdir -p /var/local/lib/isolate
sudo chown root:root /var/local/lib/isolate
sudo chmod 0755 /var/local/lib/isolate
```

Then set in `/etc/judge/judge.env`:

```
JUDGE_ISOLATE_BIN=/usr/bin/isolate
JUDGE_ISOLATE_USE_CGROUPS=1
JUDGE_ISOLATE_PROCESSES=64
JUDGE_ISOLATE_WALL_TIME_EXTRA_S=2
JUDGE_ISOLATE_TIMEOUT_GRACE_S=5
JUDGE_ISOLATE_FSIZE_KB=1024
JUDGE_PYTHON_BIN=/opt/ai-deep-dive/judge/.venv/bin/python
```

The worker override installed in step 7 keeps thread counts capped and allows
worker access to isolate runtime paths.

## 7) Install systemd services

```bash
sudo cp judge/deploy/judge-api.service /etc/systemd/system/
sudo cp judge/deploy/judge-metrics-init.service /etc/systemd/system/
sudo cp judge/deploy/judge-worker-light@.service /etc/systemd/system/
sudo cp judge/deploy/judge-worker-torch@.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now judge-api
sudo systemctl enable --now judge-worker-light@1
sudo systemctl enable --now judge-worker-torch@1
```

## 8) Apply nginx + worker hardening

Install nginx, then apply the nginx config, API binding, and worker hardening:

```bash
sudo apt-get install -y nginx
sudo JUDGE_DOMAIN=judge.example.com judge/deploy/apply.sh
```

If TLS is required, issue a certificate first (for example with certbot), then
re-run the command above. Set `JUDGE_CERT_DIR` if the certificate files live
somewhere else.

Static tests are served from `JUDGE_TESTS_ROOT` (default
`/opt/ai-deep-dive/judge/tests`) at `/judge-tests/`.

Files used:
- `judge/deploy/judge-api.service`
- `judge/deploy/judge-metrics-init.service`
- `judge/deploy/nginx/judge.http.conf.template`
- `judge/deploy/nginx/judge.https.conf.template`
- `judge/deploy/nginx/ratelimit.conf`
- `judge/deploy/systemd/worker-override.conf`
- `judge/deploy/judge-cleanup.service`
- `judge/deploy/judge-cleanup.timer`
- `judge/deploy/judge-backup.service`
- `judge/deploy/judge-backup.timer`

Cleanup settings live in `/etc/judge/judge.env`. The timer runs daily by default.
To trigger a run immediately:

```bash
sudo systemctl start judge-cleanup.service
```

Backup settings live in `/etc/judge/judge.env`. The timer runs daily by default.
To trigger a run immediately:

```bash
sudo systemctl start judge-backup.service
```

## 9) Verify

```bash
curl http://localhost:8000/health
curl http://judge.example.com/health
curl https://judge.example.com/health
```

## Metrics (Prometheus)

The API serves Prometheus metrics at `http://127.0.0.1:8000/metrics`.
Default nginx templates intentionally do not proxy `/metrics` publicly.
To include worker metrics, set `PROMETHEUS_MULTIPROC_DIR` in `/etc/judge/judge.env`.
Default is:

```
PROMETHEUS_MULTIPROC_DIR=/var/lib/judge/prometheus-multiproc
```

This directory is runtime scratch space (ephemeral shard files used by
`prometheus_client` multiprocess mode). It should be outside the git repo and
not committed. `judge/deploy/apply.sh` creates it and applies `judge:judge`
ownership.

### Install monitoring packages (Prometheus + Alertmanager + Grafana)

`install-monitoring.sh` is Ubuntu-only. It exits early on non-Ubuntu distros.

```bash
cd /opt/ai-deep-dive/judge
sudo ./deploy/monitoring/install-monitoring.sh
```

This installer:

- enables Ubuntu `universe` (needed for `prometheus-alertmanager` on some images)
- adds Grafana APT repo + signing key
- installs `prometheus`, `prometheus-node-exporter`, `prometheus-alertmanager`, `grafana`
- enables and starts all monitoring services

On non-Ubuntu systems, install equivalent packages/repos manually, then run:

```bash
cd /opt/ai-deep-dive/judge
sudo ./deploy/monitoring/apply-prometheus.sh
sudo ./deploy/monitoring/apply-alertmanager.sh
sudo ./deploy/monitoring/apply-grafana.sh
```

### Apply repo-managed Prometheus config

Templates and rules are tracked in:

- `judge/deploy/monitoring/prometheus.yml.template`
- `judge/deploy/monitoring/judge-alerts.yml`
- `judge/deploy/monitoring/apply-prometheus.sh`
- `judge/deploy/monitoring/install-monitoring.sh`
- `judge/deploy/monitoring/alertmanager.yml.template`
- `judge/deploy/monitoring/alertmanager.env.example`
- `judge/deploy/monitoring/apply-alertmanager.sh`
- `judge/deploy/monitoring/grafana-datasource.yml.template`
- `judge/deploy/monitoring/grafana-dashboard-provider.yml.template`
- `judge/deploy/monitoring/grafana/judge-overview.json`
- `judge/deploy/monitoring/apply-grafana.sh`
- `judge/deploy/monitoring/send-test-alert.sh`

Apply them on the monitoring host:

```bash
cd /opt/ai-deep-dive/judge
sudo ./deploy/monitoring/apply-prometheus.sh
```

For a separate monitoring VM, set target lists explicitly:

```bash
cd /opt/ai-deep-dive/judge
sudo JUDGE_API_TARGETS=10.0.1.4:80 \
  NODE_EXPORTER_TARGETS=10.0.1.4:9100 \
  ./deploy/monitoring/apply-prometheus.sh
```

Topology notes:

- Single-VM default: keep `JUDGE_API_TARGETS=127.0.0.1:8000` and scrape local loopback.
- Separate monitoring VM: API service binds to `127.0.0.1` by default
  (`judge/deploy/judge-api.service`), so remote Prometheus cannot scrape `:8000` directly.
- For separate monitoring VM, expose API metrics through a private-network path
  (for example nginx on private IP/interface, restricted to monitoring VM IP/CIDR),
  then set `JUDGE_API_TARGETS` to that private endpoint.

The script validates with `promtool` (if installed), writes
`/etc/prometheus/prometheus.yml`, installs rule file
`/etc/prometheus/rules/judge-alerts.yml`, then restarts Prometheus.
`apply-prometheus.sh` also renders alert thresholds from environment so rules
track your worker/capacity configuration automatically.

By default the script reads `/etc/judge/judge.env` (if present), then applies
these alert tuning variables:

- `ALERT_LIGHT_WORKERS` / `ALERT_TORCH_WORKERS` (fallback to `JUDGE_LIGHT_WORKERS` / `JUDGE_TORCH_WORKERS`)
- `ALERT_LIGHT_SEC_PER_JOB` / `ALERT_TORCH_SEC_PER_JOB` (capacity model per worker)
- `ALERT_CAPACITY_SAFETY` (default `0.8`)
- `ALERT_BACKLOG_WARN_MINUTES` and `ALERT_BACKLOG_FOR` (queue lag warning calibration)
- `ALERT_QUEUE_WAIT_P95_WARN_SECONDS`, `ALERT_QUEUE_WAIT_WINDOW`,
  `ALERT_QUEUE_WAIT_FOR`, `ALERT_QUEUE_WAIT_MIN_STARTS`
- `ALERT_WORKER_HEARTBEAT_STALE_SECONDS` and `ALERT_WORKER_HEALTH_FOR`
- `ALERT_INTERNAL_ERROR_RATE_THRESHOLD`, `ALERT_INTERNAL_ERROR_WINDOW_MINUTES`,
  `ALERT_INTERNAL_ERROR_FOR`, `ALERT_INTERNAL_ERROR_MIN_COMPLETIONS`

Backlog warning thresholds are computed as:

- `safe_throughput = workers * (1 / sec_per_job) * ALERT_CAPACITY_SAFETY`
- `warn_backlog = ceil(safe_throughput * ALERT_BACKLOG_WARN_MINUTES * 60)`

Prometheus is also configured to send alerts to Alertmanager. Default
Alertmanager target is `127.0.0.1:9093`. Override with
`ALERTMANAGER_TARGETS`.

### Install and apply Alertmanager (Telegram + email)

```bash
sudo install -d -m 700 /etc/judge
sudo cp /opt/ai-deep-dive/judge/deploy/monitoring/alertmanager.env.example /etc/judge/alertmanager.env
sudo chmod 600 /etc/judge/alertmanager.env
# edit /etc/judge/alertmanager.env with your real values
cd /opt/ai-deep-dive/judge
sudo ./deploy/monitoring/apply-alertmanager.sh
```

`apply-alertmanager.sh` loads `/etc/judge/alertmanager.env` by default, renders
Alertmanager config, validates with `amtool` when available, then restarts
`prometheus-alertmanager` (or `alertmanager` when that service name is used).
When using `prometheus-alertmanager`, the script also enforces single-node
runtime flags in `/etc/default/prometheus-alertmanager` to avoid gossip mesh
startup failures.

Telegram-only setup works by providing only Telegram variables.
Email-only setup works by providing only email/SMTP variables.

### Install and apply Grafana

```bash
cd /opt/ai-deep-dive/judge
sudo ./deploy/monitoring/apply-grafana.sh
```

This provisions:

- Prometheus datasource (`uid: prometheus`)
- Judge dashboard provider
- `Judge Overview` dashboard from repo JSON

Default Grafana access is port `3000`. For private access from your laptop:

```bash
ssh -N -L 13000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 root@<vm-ip-or-dns-only-host>
```

Then open:

- `http://127.0.0.1:13000` (Grafana)
- `http://127.0.0.1:9090` (Prometheus)

### Test Telegram/email notifications

Inject a synthetic alert directly into Alertmanager:

```bash
cd /opt/ai-deep-dive/judge
sudo ./deploy/monitoring/send-test-alert.sh
```

Expected:

- Telegram bot sends a message to `ALERTMANAGER_TELEGRAM_CHAT_ID` (if configured).
- Email receiver gets a message (if configured).

## Scaling on a single VM

- Increase `JUDGE_API_WORKERS`, `JUDGE_LIGHT_WORKERS`, and `JUDGE_TORCH_WORKERS` in `/etc/judge/judge.env`.
- Re-run `judge/deploy/apply.sh` to start the new instances.
