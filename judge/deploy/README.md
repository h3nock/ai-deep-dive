# VM deployment (single VM)

Minimal systemd setup for an Ubuntu VM.

## 1) Create user + folders

```bash
sudo adduser --system --group judge
sudo mkdir -p /opt/ai-deep-dive
sudo mkdir -p /etc/judge
sudo chown -R judge:judge /opt/ai-deep-dive
```

## 2) Copy repo and create venv

```bash
# clone repo into /opt/ai-deep-dive
sudo -u judge git clone <your-repo-url> /opt/ai-deep-dive
cd /opt/ai-deep-dive/judge
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

CPU-only PyTorch is required to run torch problems on the VM. Install it in
the same venv using the official PyTorch install selector.

## 3) Configure environment

```bash
sudo cp judge/deploy/judge.env.example /etc/judge/judge.env
sudo chown judge:judge /etc/judge/judge.env
```

Set `JUDGE_ALLOWED_ORIGINS` when the web app is hosted on a different origin.

## 4) Install and start Redis

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

## 5) Nsjail sandbox

Install nsjail (Ubuntu):

```bash
sudo apt-get install -y nsjail uidmap
sudo mkdir -p /etc/judge
sudo cp judge/deploy/nsjail.cfg /etc/judge/nsjail.cfg
```

Nsjail uses user namespaces. Assign a subuid/subgid range to the judge user:

```bash
sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 judge
```

Confirm `/etc/subuid` and `/etc/subgid` contain the same range for `judge`.

Then set in `/etc/judge/judge.env`:

```
JUDGE_SANDBOX_CMD_JSON=["nsjail","--config","/etc/judge/nsjail.cfg","--"]
```

Edit `/etc/judge/nsjail.cfg` to match the `outside_id` range from `/etc/subuid`
and `/etc/subgid`. The rlimit values are in MB or seconds.

The worker override installed in step 7 is required so nsjail can create user
namespaces. Run that step after enabling nsjail.

## 6) Install systemd services

```bash
sudo cp judge/deploy/judge-api.service /etc/systemd/system/
sudo cp judge/deploy/judge-worker-light@.service /etc/systemd/system/
sudo cp judge/deploy/judge-worker-torch@.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now judge-api
sudo systemctl enable --now judge-worker-light@1
sudo systemctl enable --now judge-worker-torch@1
```

## 7) Apply nginx + worker hardening

Install nginx, then apply the nginx config, API binding, and worker hardening:

```bash
sudo apt-get install -y nginx
sudo JUDGE_DOMAIN=judge.example.com judge/deploy/apply.sh
```

If TLS is required, issue a certificate first (for example with certbot), then
re-run the command above. Set `JUDGE_CERT_DIR` if the certificate files live
somewhere else.

Files used:
- `judge/deploy/judge-api.service`
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

## 8) Verify

```bash
curl http://localhost:8000/health
curl http://judge.example.com/health
curl https://judge.example.com/health
```

## Scaling on a single VM

- Increase `JUDGE_LIGHT_WORKERS` and `JUDGE_TORCH_WORKERS` in `/etc/judge/judge.env`.
- Re-run `judge/deploy/apply.sh` to start the new instances.
