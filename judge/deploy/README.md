# VM deployment (single VM)

Minimal systemd setup for an Ubuntu VM.

## Canonical workflow

Use deploy scripts in this order:

1. `bootstrap.sh` for first-time VM setup and repeatable deploy bootstrap.
2. `apply.sh` for fast code/config re-apply on an existing VM.
3. `verify.sh` as the required post-deploy gate.

### First-time VM setup

```bash
# clone repo first (or set JUDGE_REPO_URL for bootstrap clone support)
sudo git clone <your-repo-url> /opt/ai-deep-dive
cd /opt/ai-deep-dive/judge

# CPU torch (default)
sudo JUDGE_DOMAIN=judge.example.com ./deploy/bootstrap.sh
```

`bootstrap.sh` is idempotent. Re-running it is safe.
It creates the `judge` system user and required directories if they do not
already exist.
It uses `uv` for virtualenv/package install when available, and falls back to
`python3 -m venv` + `pip` when `uv` is not installed.
It enforces CPU-only PyTorch wheels for this VM profile and replaces CUDA
wheels if they are present.
It also configures Redis durability/safety settings (`appendonly yes`,
`appendfsync everysec`, `maxmemory-policy noeviction`).

### Existing VM update

```bash
cd /opt/ai-deep-dive
sudo -u judge git pull --ff-only
cd /opt/ai-deep-dive/judge
sudo JUDGE_DOMAIN=judge.example.com ./deploy/apply.sh
sudo ./deploy/verify.sh
```

`apply.sh` also enforces CPU-only PyTorch wheels for the judge runtime.

### Health-only check

```bash
cd /opt/ai-deep-dive/judge
sudo ./deploy/verify.sh
```

Optional verify overrides:

- `JUDGE_VERIFY_API_URL` (default `http://127.0.0.1:8000`)
- `JUDGE_VERIFY_SMOKE_PROBLEM_ID` (default `sample/01-basics/01-add`)
- `JUDGE_VERIFY_SMOKE_CODE` (default code for the sample add problem)
- `JUDGE_VERIFY_SMOKE_EXPECTED_STATUS` (default `Accepted`)
- `JUDGE_VERIFY_SMOKE_TIMEOUT_S` (default `30`)

### Environment file

`bootstrap.sh` creates `/etc/judge/judge.env` from
`deploy/judge.env.example` if it does not exist. All runtime `JUDGE_*` keys
must be represented in `judge.env.example`.

Set `JUDGE_ALLOWED_ORIGINS` for your deployed web origins.

### Worker model and reconciliation

Deployment uses template worker units only:

- `judge-worker-light@N.service`
- `judge-worker-torch@N.service`

`apply.sh` enforces exact worker counts from `/etc/judge/judge.env`:

- `JUDGE_LIGHT_WORKERS`
- `JUDGE_TORCH_WORKERS`

Legacy non-template units are always disabled to avoid mixed-consumer drift:

- `judge-worker-light.service`
- `judge-worker-torch.service`

Any active template unit above the configured count is also stopped and
disabled during reconciliation.

Worker template services run with systemd watchdog enabled (`Type=notify`).
Workers send readiness/watchdog pings from the main loop, so systemd can
restart hung worker processes even if the process does not exit on its own.

### Test bundle export

Public bundles are served from `/judge-tests/`. Hidden tests are exported to
the tests root for server-side execution and are not publicly served.

`bootstrap.sh` exports bundles automatically. To refresh manually:

```bash
cd /opt/ai-deep-dive/judge
sudo -u judge env PYTHONPATH=src .venv/bin/python scripts/export_tests_endpoint.py --out-root /opt/ai-deep-dive/judge/tests
```

### Warm-fork security probe

```bash
cd /opt/ai-deep-dive/judge
sudo -u judge env PYTHONPATH=src .venv/bin/python scripts/warm_fork_security_probe.py
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
- provides systemd unit-state metrics (`node_systemd_unit_state`) used by
  worker-missing alerts

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
- `ALERT_WORKER_HEALTH_FOR` (worker-missing alert hold duration)
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
