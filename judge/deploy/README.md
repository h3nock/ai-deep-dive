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

If you will run torch problems on this VM, install CPU-only PyTorch in this venv
using the official PyTorch install selector.

## 3) Configure environment

```bash
sudo cp judge/deploy/judge.env.example /etc/judge/judge.env
sudo chown judge:judge /etc/judge/judge.env
```

Set `JUDGE_ALLOWED_ORIGINS` if the web app is hosted on a different origin.

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

## 5) Optional: nsjail sandbox

Install nsjail (Ubuntu):

```bash
sudo apt-get install -y nsjail
sudo mkdir -p /etc/judge
sudo cp judge/deploy/nsjail.cfg /etc/judge/nsjail.cfg
```

Then set in `/etc/judge/judge.env`:

```
JUDGE_SANDBOX_CMD_JSON=["nsjail","--config","/etc/judge/nsjail.cfg","--"]
```

Edit `/etc/judge/nsjail.cfg` to set the `uidmap`/`gidmap` values for your
`judge` user (`id -u judge`, `id -g judge`). The rlimit values are in MB/seconds.

## 6) Install systemd services

```bash
sudo cp judge/deploy/judge-api.service /etc/systemd/system/
sudo cp judge/deploy/judge-worker-light.service /etc/systemd/system/
sudo cp judge/deploy/judge-worker-torch.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now judge-api
sudo systemctl enable --now judge-worker-light
sudo systemctl enable --now judge-worker-torch
```

## 7) Verify

```bash
curl http://localhost:8000/health
```

## Scaling on a single VM

- Add more workers by cloning the service file with a unique `--consumer` name.
- Keep torch workers fewer than light workers.
