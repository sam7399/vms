# Gem Aromatics VMS — Self-host SQL guide

For IT teams that want to run **PostgreSQL on-premise** (your own data center, your own server) instead of using a managed cloud database.

Three valid approaches; pick one.

| Approach | When it fits | Effort | DB admin needed |
|---|---|---|---|
| **A — Compose-managed Postgres (default)** | You're already self-hosting the app stack with Docker | Zero (already done in INSTALL.md) | No |
| **B — Standalone Postgres on a separate server** | You want the DB on dedicated hardware, separate from the app | 1 hour | Light |
| **C — Existing Postgres cluster (you already run one)** | Your IT already operates Postgres for other systems | 30 min | Yes |

---

## Approach A — Postgres inside Docker Compose (recommended for ≤500 employees)

**Already done.** The default `docker-compose.prod.yml` includes a `postgres` service with:

- Postgres 16 Alpine
- Persistent volume `pgdata` (survives container restarts)
- Nightly automated backups to `./backups/`
- Healthcheck loop
- Bound to `127.0.0.1:5432` only — not exposed externally

If you followed `INSTALL.md`, you already have this. No further work.

**Capacity:** comfortably handles ≤500 employees + ≤2,000 visits/day. Beyond that, switch to Approach B or C.

---

## Approach B — Standalone Postgres on a separate server

Use this when you want the database on dedicated hardware (its own server, its own backups, its own monitoring). Common in regulated environments.

### B.1 Install Postgres on the DB server

Ubuntu 22.04 / Debian 12:

```bash
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
sudo systemctl enable --now postgresql

# Verify
sudo -u postgres psql -c "SELECT version();"
```

Windows Server: download the installer from https://www.postgresql.org/download/windows/ and run the wizard. Pick the same version (16.x). Keep all defaults except set a strong `postgres` superuser password when prompted.

### B.2 Create the application database + user

```bash
sudo -u postgres psql
```

In the psql prompt:

```sql
CREATE USER gem WITH PASSWORD 'strong-password-here';
CREATE DATABASE gem_vms OWNER gem;
GRANT ALL PRIVILEGES ON DATABASE gem_vms TO gem;
\q
```

### B.3 Allow the app server to connect

Edit `/etc/postgresql/16/main/postgresql.conf`:

```
listen_addresses = '*'
```

Edit `/etc/postgresql/16/main/pg_hba.conf` — add this line at the end (replace `10.0.0.5` with your app server's IP):

```
host    gem_vms    gem    10.0.0.5/32    scram-sha-256
```

Restart:

```bash
sudo systemctl restart postgresql
```

Also open port 5432 on the DB server's firewall for the app server's IP only:

```bash
sudo ufw allow from 10.0.0.5 to any port 5432
```

### B.4 Point the app at it

On the **app server**, edit `/opt/gem-vms/.env`:

```env
# Comment out the in-stack Postgres (we'll skip starting it)
# POSTGRES_PASSWORD=...

# Point the API at the standalone DB
DATABASE_URL=postgresql://gem:strong-password-here@<DB_SERVER_IP>:5432/gem_vms
```

Then trim the Compose stack so it doesn't start its own Postgres + backup containers — easiest is to use a new `docker-compose.external-db.yml`:

```yaml
services:
  redis:
    extends:
      file: docker-compose.prod.yml
      service: redis

  api:
    extends:
      file: docker-compose.prod.yml
      service: api
    # Override: the API no longer waits for the local Postgres container
    depends_on:
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}

  web:
    extends:
      file: docker-compose.prod.yml
      service: web
```

Bring it up:

```bash
docker compose -f docker-compose.external-db.yml up -d --build
```

The API auto-runs `prisma db push` against your standalone Postgres on first boot, creating every table.

### B.5 Backups (on the DB server)

```bash
sudo crontab -e
```

Add:

```cron
0 3 * * * sudo -u postgres pg_dump gem_vms | gzip > /var/backups/gem_vms_$(date +\%Y\%m\%d).sql.gz
0 4 * * 0 find /var/backups/ -name "gem_vms_*.sql.gz" -mtime +30 -delete
```

Nightly 3 AM dump, Sunday 4 AM cleanup of dumps older than 30 days. Sync `/var/backups/` to off-site storage with `rclone` or similar.

---

## Approach C — Existing Postgres cluster

If your IT team already operates Postgres for other internal systems:

### C.1 Create database + user

In your existing cluster:

```sql
CREATE USER gem WITH PASSWORD 'strong-password-here';
CREATE DATABASE gem_vms OWNER gem;
GRANT ALL PRIVILEGES ON DATABASE gem_vms TO gem;
```

### C.2 Point the API at it

Same as B.4. Set `DATABASE_URL` in `.env` to your cluster's connection string. Use the `docker-compose.external-db.yml` variant.

### C.3 Schema migrations

The API auto-runs `prisma db push` on each boot. This is **idempotent and additive** for new columns / tables, but it will refuse to apply changes that would lose data without `--accept-data-loss`. If your IT requires a stricter migration workflow:

```bash
# Generate a migration file locally instead of using db push
cd packages/database
npx prisma migrate dev --create-only --name <descriptive-name>
# Review the generated SQL under prisma/migrations/<timestamp>_<name>/migration.sql
# Apply it manually to your cluster, or check it into a separate migrations pipeline.
```

You can then disable `prisma db push` in production by removing the wrapper from `railway.json` / the Dockerfile's start script and applying migrations via your normal change-management process.

---

## Required Postgres extensions

The app does not require any extensions beyond what ships with stock Postgres 14+.

If you're on Postgres 13 or older, upgrade. The schema uses features (e.g. `json` query operators, generated column defaults) that need 14+.

---

## Sizing guide

| Tier | Visits/day | Workers | Postgres specs |
|---|---|---|---|
| Small | ≤500 | ≤200 | 2 vCPU, 4 GB RAM, 30 GB SSD |
| Medium | ≤5,000 | ≤2,000 | 4 vCPU, 8 GB RAM, 100 GB SSD |
| Large | ≤25,000 | ≤10,000 | 8 vCPU, 16 GB RAM, 300 GB SSD |
| Enterprise | >25,000 | >10,000 | Run a managed Postgres or HA cluster |

Gem Aromatics' current footprint (~230 employees, single branch) sits comfortably in **Small** for years.

---

## Connection security

Whatever path you pick, set this in your `.env`:

```env
# Require TLS — your client (the API container) will refuse plaintext
DATABASE_URL=postgresql://gem:pwd@host:5432/gem_vms?sslmode=require
```

For Approach A (DB inside Compose) the network is bridged and isolated; TLS is optional. For B and C, **require TLS**.

To force the standalone Postgres server to use TLS:

1. Generate a self-signed cert (or use one from your internal CA).
2. Drop it at `/etc/postgresql/16/main/server.crt` + `server.key`.
3. In `postgresql.conf`: `ssl = on`.
4. In `pg_hba.conf`: replace `host` lines with `hostssl`.
5. Restart Postgres.

---

## Daily operations cheatsheet (any approach)

```bash
# Connect to the DB
docker compose -f docker-compose.prod.yml exec postgres psql -U gem -d gem_vms
# or, for standalone:
psql "postgresql://gem:pwd@10.0.0.10:5432/gem_vms"

# Quick row counts
SELECT 'visits' AS table, COUNT(*) FROM "Visit"
UNION ALL SELECT 'workers', COUNT(*) FROM "Worker"
UNION ALL SELECT 'contractors', COUNT(*) FROM "Contractor"
UNION ALL SELECT 'users', COUNT(*) FROM "User"
UNION ALL SELECT 'incidents', COUNT(*) FROM "Incident";

# Database size
SELECT pg_size_pretty(pg_database_size('gem_vms'));

# Slowest queries (needs pg_stat_statements; enable in postgresql.conf)
SELECT calls, mean_exec_time::int AS avg_ms, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## When to escalate to Personify Crafters

- Schema migration fails — send us the `prisma db push` error output.
- Sustained query latency > 200 ms — we'll add indexes or rewrite the query.
- Database size growth feels off — we'll review retention + cleanup policies.
- You want to swap from Postgres to another database — that's a substantial engagement; talk to us first.
