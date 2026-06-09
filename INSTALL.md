# Gem Aromatics VMS — Installation guide

Two paths. Pick one based on whether you want to manage the database yourself or use a managed cloud Postgres.

| Path | When to use | Effort | Monthly cost |
|---|---|---|---|
| **A — Self-host (single Linux server with Docker)** | You want every byte on your own infrastructure. Full control. | 1–2 hours first time | Your server only |
| **B — Cloud (Vercel + Railway + Neon)** | You want hands-off ops, no servers to patch. | 30 minutes first time | ~$30–50/mo at scale |

Both paths run the same code. You can start on B and migrate to A later (the database is one `pg_dump` → `pg_restore` away). The other direction works the same.

The rest of this guide covers **Path A** (self-host). For Path B, follow `HANDOVER.md` § 4 instead.

---

## 0. Pre-requisites

Before you start, you need:

- A Linux server. Ubuntu 22.04 LTS or Debian 12 recommended. Minimum 2 vCPU, 4 GB RAM, 30 GB SSD. AWS t3.medium, DigitalOcean 4 GB droplet, or any equivalent.
- Root or sudo access on that server.
- A domain (e.g. `vms.gemaromatics.in`) pointed at the server's public IP via DNS A record. Required if you want HTTPS (which you do — face recognition needs HTTPS).
- About one hour of focused time.

You do **not** need:

- A database admin. Postgres comes inside the Docker stack and self-manages.
- Node.js, Postgres, or any other thing installed on the host. Docker covers everything.

---

## 1. Install Docker + Compose on the server

```bash
# SSH into your server first, then:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out + back in for the group change to take effect
newgrp docker

# Verify
docker --version            # should print Docker version 24.x or newer
docker compose version      # should print v2.x
```

---

## 2. Get the source code

You have two options:

**Option a — clone from GitHub (preferred):**

```bash
cd /opt
sudo mkdir gem-vms && sudo chown $USER:$USER gem-vms
cd gem-vms
git clone https://github.com/<your-org>/<your-repo>.git .
```

**Option b — unpack the handover ZIP:**

```bash
cd /opt
sudo mkdir gem-vms && sudo chown $USER:$USER gem-vms
cd gem-vms
# Upload Gem-VMS-handover.zip to ~ via scp, sftp, or a file manager, then:
unzip ~/Gem-VMS-handover.zip -d .
```

You should now see `apps/`, `packages/`, `docker-compose.prod.yml`, `HANDOVER.md`, etc. directly inside `/opt/gem-vms`.

---

## 3. Configure secrets

```bash
cd /opt/gem-vms
cp .env.gem.example .env
nano .env
```

Fill every value flagged `CHANGE_ME_*`. The two most critical:

```bash
# Strong DB password (one-liner generator)
openssl rand -base64 32

# Strong JWT secret (one-liner generator)
openssl rand -hex 32
```

If you're putting this behind a domain right away, also set:

```env
PUBLIC_API_URL=https://api.vms.gemaromatics.in
CORS_ORIGIN=https://vms.gemaromatics.in
```

Save and close.

---

## 4. First boot

```bash
docker compose -f docker-compose.prod.yml up -d
```

First boot takes about 5–10 minutes (Docker pulls images, builds the API and web containers). Watch progress:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

When the API container prints `Application is running on: http://0.0.0.0:4000`, hit Ctrl-C to drop out of the log stream. The stack stays running.

**Verify health:**

```bash
curl http://localhost:4000/health
# Expect: {"ok":true,"uptime":...}

curl -I http://localhost:3000
# Expect: HTTP/1.1 200 OK
```

---

## 5. Schema + first super-admin

The API auto-runs `prisma db push` on boot, so the schema is already in place. You only need to seed the first admin:

```bash
docker compose -f docker-compose.prod.yml exec api sh -c "\
  cd /repo/apps/api && \
  GEM_ADMIN_EMAIL=admin@gemaromatics.in \
  GEM_ADMIN_PASSWORD='choose-a-strong-one' \
  GEM_ADMIN_NAME='Gem Admin' \
  node /repo/scripts/seed-gem.js"
```

To wipe operational data before reseeding (only do this when you genuinely
want to clear visits/workers/contractors — destructive):

```bash
docker compose -f docker-compose.prod.yml exec api sh -c "\
  cd /repo/apps/api && node /repo/scripts/clear-demo-data.js --confirm"
```

Open `http://<your-server-ip>:3000/auth/login` and log in.

---

## 6. Put a domain + HTTPS in front

Skip this section if you're only testing on the LAN.

The simplest production-ready front-end is Caddy. It does HTTPS, certificate renewal and reverse-proxying with five lines of config.

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```

Paste this (replace the two domains with yours):

```caddy
vms.gemaromatics.in {
  reverse_proxy localhost:3000
}

api.vms.gemaromatics.in {
  reverse_proxy localhost:4000
}
```

```bash
sudo systemctl reload caddy
```

Caddy fetches a Let's Encrypt cert automatically. Both domains now serve over HTTPS.

Then update `.env`:

```env
PUBLIC_API_URL=https://api.vms.gemaromatics.in
CORS_ORIGIN=https://vms.gemaromatics.in
```

…and rebuild the web container so the new API URL is baked into the build:

```bash
docker compose -f docker-compose.prod.yml up -d --build web
```

---

## 7. Backups

The stack already includes a `backup` container that dumps Postgres to `./backups/` every 24 h and keeps the last 14 dumps. To restore:

```bash
# pick a dump file
ls /opt/gem-vms/backups/

# restore (will overwrite existing data)
gunzip -c /opt/gem-vms/backups/gem_vms_20260615_030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U gem -d gem_vms
```

For off-site safety, sync `/opt/gem-vms/backups/` to S3, Backblaze, or any external storage. A 1-line cronjob with `rclone` is the typical move.

---

## 8. Updating the platform

When Personify Crafters ships an update:

```bash
cd /opt/gem-vms
git pull origin main          # or re-upload the new ZIP
docker compose -f docker-compose.prod.yml up -d --build
```

The API auto-runs `prisma db push` on each boot, so any new tables / columns are applied automatically. Backups are taken before the migration as part of the nightly cycle — but for major upgrades, run a manual backup first:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U gem -d gem_vms | gzip > /opt/gem-vms/backups/pre-upgrade.sql.gz
```

---

## 9. Daily operations

| Task | Command |
|---|---|
| View live API logs | `docker compose -f docker-compose.prod.yml logs -f api` |
| View live web logs | `docker compose -f docker-compose.prod.yml logs -f web` |
| Restart everything | `docker compose -f docker-compose.prod.yml restart` |
| Restart API only | `docker compose -f docker-compose.prod.yml restart api` |
| Stop everything | `docker compose -f docker-compose.prod.yml down` |
| Stop + wipe volumes | `docker compose -f docker-compose.prod.yml down -v` ⚠️ deletes the DB |
| Manual DB backup | `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U gem -d gem_vms > backup.sql` |
| Manual DB restore | `cat backup.sql \| docker compose -f docker-compose.prod.yml exec -T postgres psql -U gem -d gem_vms` |
| Disk usage | `du -sh /var/lib/docker/volumes/* \| sort -h` |
| Update + redeploy | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |

---

## 10. Troubleshooting

**API container exits immediately** — almost always a bad `DATABASE_URL` or missing `JWT_SECRET`. Check:

```bash
docker compose -f docker-compose.prod.yml logs api | tail -50
```

**Web shows "Cannot reach API"** — make sure `PUBLIC_API_URL` in `.env` is reachable from the user's browser (not from inside the server). Rebuild the web container after fixing:

```bash
docker compose -f docker-compose.prod.yml up -d --build web
```

**Postgres data lost after restart** — you ran `down -v` instead of `down`. The `-v` flag wipes volumes. Restore from `./backups/`.

**Out of disk space** — Docker layers + Postgres can grow. Reclaim:

```bash
docker system prune -af --volumes  # ⚠️ removes everything not currently in use
```

**Cannot publish on Play Store from a self-hosted setup** — that's fine. The mobile app build (`apps/mobile`) is published via EAS, not from your server. See `HANDOVER.md` § 5 for the Play Store steps.

---

## 11. Migrating from cloud to self-host (or vice versa)

The database is the only piece of state. To migrate either direction:

```bash
# 1. Dump from source
pg_dump "<source DATABASE_URL>" > full.sql

# 2. Restore to target
psql "<target DATABASE_URL>" < full.sql

# 3. Point the API at the new DB (change DATABASE_URL on Railway, or the
#    `.env` if self-hosted) and restart it.
```

That's it. Everything else is stateless.

---

## 12. Support

- Day-2 changes / fixes: contact your Personify Crafters account manager.
- Production-down emergencies: see HANDOVER.md § 6.
- Self-host issues outside scope of the platform (server OS, networking, DNS): your sysadmin team.
