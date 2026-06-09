# Gem Aromatics — VMS handover

Prepared by **Personify Crafters** for **Gem Aromatics Limited**.

This document is everything needed to take the platform live, list the mobile app on Google Play, and keep it maintained after handover.

---

## 1. What you are receiving

| Component | What it is | Where it runs |
|---|---|---|
| Web dashboard | Next.js 14 — operator UI for security, hosts, admin, reports, executive dashboard | Vercel |
| Mobile app | Expo / React Native — host-side app for approvals, gate ops, visitor pre-register | Google Play (after listing) |
| Kiosk | Next.js — front-desk self-service check-in | Vercel (second project) |
| API | NestJS 10 + Prisma 5 + Socket.io 4 — REST + realtime | Railway |
| Database | PostgreSQL | Neon |
| Cache + queues | Redis (optional, falls back to inline mode) | Upstash |
| Email | Resend (transactional + report email) | resend.com |
| Push | Expo Push | exp.host |
| Face recognition | face-api.js (TinyFaceDetector + 128-d descriptors) | client-side, models from CDN |

Source code lives in one GitHub monorepo. One Git push deploys both API and web.

---

## 2. Accounts you must own before handover

Set these up in **Gem Aromatics** name before we hand over the keys. Once these are yours we transfer ownership and remove our team from each.

1. **GitHub** — to host the source code repository.
2. **Vercel** — to deploy web + kiosk. Free tier is enough to start.
3. **Railway** — to deploy the API. Paid plan (~$5/mo minimum) — required because the API can't sleep.
4. **Neon** — Postgres. Free tier OK for first 6 months; upgrade when DB > 0.5 GB.
5. **Upstash** *(optional)* — Redis. Free tier (10K commands/day) covers light usage.
6. **Resend** — for transactional + report emails. Free plan covers ~100/day; verify your `gemaromatics.in` (or any owned) domain to send from a Gem address.
7. **Google Cloud / Play Console** — `$25` one-time developer fee. Required to publish the mobile app.
8. **Domain** — typically a subdomain off `gemaromatics.in` (e.g. `vms.gemaromatics.in`). DNS managed by whoever owns the parent domain.
9. **Expo / EAS** *(optional)* — only needed if you want OTA updates without a Play Store release. Free hobby plan works.

---

## 3. Environment variables

Set these in the relevant deployment dashboard. Everything here is required unless marked optional.

### API (Railway)

```bash
DATABASE_URL=postgresql://...            # Neon pooled connection string
JWT_SECRET=<32+ char random string>      # generate with: openssl rand -hex 32
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://vms.gemaromatics.in  # your prod web domain

# Optional but recommended
REDIS_URL=rediss://...                   # Upstash TLS string (jobs run inline without this)
RESEND_API_KEY=re_...                    # to actually send emails
RESEND_FROM="Gem VMS <vms@gemaromatics.in>"  # must be a verified domain in Resend

# Branding (for email footer)
BRAND_FOOTER_TEXT=Gem Aromatics Limited · powered by Personify Crafters
```

### Web (Vercel)

```bash
NEXT_PUBLIC_API_URL=https://<your-railway-host>.up.railway.app
NEXT_PUBLIC_BRAND_CODE=gem              # MUST be 'gem' to load Gem branding
```

### Kiosk (Vercel — second project)

Same as Web.

### Mobile (`apps/mobile/eas.json` channel config)

```bash
EXPO_PUBLIC_API_URL=https://<your-railway-host>.up.railway.app
```

---

## 4. First-time deploy steps

> Do these in order. The whole sequence takes about an hour first time.

1. **Create GitHub repo under Gem Aromatics org** — push the handed-over source code to it. Tag the first commit `v1.0`.
2. **Create Neon project** — copy the *pooled* connection string. Save as `DATABASE_URL`.
3. **Create Railway project** → connect to your GitHub repo. Add env vars from §3. Railway will pick up `railway.json` and auto-run `prisma db push` on boot, which creates every table.
4. **Verify API health** → open `https://<railway-host>/health` — must return `{ "ok": true }`.
5. **Wipe + seed Gem tenant** (clears any leftover demo data):

   ```bash
   # one-shot, run from your laptop with DATABASE_URL exported
   node scripts/clear-demo-data.js --confirm
   GEM_ADMIN_EMAIL=admin@gemaromatics.in \
   GEM_ADMIN_PASSWORD='<choose a strong one>' \
   GEM_ADMIN_NAME='Gem Admin' \
     node scripts/seed-gem.js
   ```

6. **Create Vercel project** → connect to GitHub repo → set Root Directory to `apps/web` → add env vars → deploy.
7. **Add domain in Vercel** (e.g. `vms.gemaromatics.in`) → Vercel shows the DNS records to add. Add them at whoever runs DNS for `gemaromatics.in` (CNAME or A record per Vercel's instructions).
8. **Repeat steps 6–7 for the kiosk** (Root Directory `apps/kiosk`, separate Vercel project, separate subdomain like `kiosk.gemaromatics.in`).
9. **Smoke test** — log in as the seeded admin at the web URL, create a branch, create one visit, walk the full check-in → check-out flow.

After this, every push to `main` auto-deploys both web and API. There is no other manual step.

---

## 5. Publishing the mobile app on Google Play

Pre-requisites: Google Play Console developer account ($25 one-time), the EAS account ID, app icon (1024×1024 PNG), feature graphic (1024×500 PNG).

```bash
# 1. Switch into mobile workspace
cd apps/mobile

# 2. Set the API URL the app should hit in production
# Edit eas.json → "production" channel → EXPO_PUBLIC_API_URL

# 3. Build a production .aab (Android App Bundle — required by Play Store)
npx eas build --platform android --profile production

# 4. After ~20 min, EAS gives a downloadable .aab URL. Download it.

# 5. In Play Console:
#    - Create new app named "Gem VMS"
#    - Fill app details (description, screenshots, privacy policy URL)
#    - Internal testing → upload the .aab → roll out to internal testers first
#    - When happy: promote to production
```

**Privacy policy:** Google requires a public privacy policy URL because the app uses camera and notifications. We provide a template at `apps/web/src/app/about/page.tsx` — copy the relevant block to a public page like `vms.gemaromatics.in/privacy` before submitting.

**Google review** takes 2–7 days for the first release. Subsequent releases are typically a few hours.

For OTA updates (small JS-only changes without Play resubmission), use:

```bash
npx eas update --branch production --message "fixed approval flow bug"
```

---

## 6. Day-2 maintenance — how we make future changes

This is the model we discussed:

1. **You report what you want** via email or WhatsApp to your account manager at Personify Crafters.
2. **You give us limited API access** to your Railway + Vercel + Neon for the duration of the work. We do *not* need standing access.
3. **We branch off `main`** in the GitHub repo, build the change in a feature branch.
4. **You review the change** in a preview deployment (Vercel auto-creates a preview URL per branch).
5. **You merge** when happy → auto-deploys to production.
6. **We remove ourselves** from the Railway/Vercel projects.

For larger projects we'll quote in advance. Small changes (typo fixes, single config tweaks) are typically same-day.

**Emergency hotline:** for production-down incidents, escalate via [your contact channel here] — we commit to a response within 4 hours on weekdays and 8 hours on weekends.

---

## 7. Backups

| What | Where | How often | Retention |
|---|---|---|---|
| Database | Neon automatic snapshots | Continuous (point-in-time-recovery) | 7 days on free, 30 days on paid |
| Source code | GitHub | On every push | Forever |
| Mobile builds | EAS build history | On every build | Indefinite for paid plans |
| Demo backup of this platform | Git tag `v1.0-demo` on origin + `AEGIS-v1.0-demo-backup.zip` on handover drive | Frozen snapshot before rebrand | Forever |

To restore the database to a point in time: Neon dashboard → Branches → "Restore from time" → pick the timestamp.

---

## 8. Cost projection (USD, post-handover)

| Service | Free tier covers | Paid starts at | Notes |
|---|---|---|---|
| Vercel | 100 GB bandwidth + unlimited builds for hobby | $20/mo (Pro) | Pro recommended once traffic > 100 GB/mo |
| Railway | 500 hours/mo on $5 starter | $5/mo + usage | API can't sleep, so a paid plan from day one is needed |
| Neon | 0.5 GB storage, 1 project | $19/mo | Upgrade when DB > 0.5 GB |
| Upstash Redis | 10K commands/day | $0.20/100K commands | Optional |
| Resend | 3,000 emails/mo | $20/mo (50K emails) | Required for transactional + report emails |
| Google Play | n/a | $25 one-time | Lifetime developer account |

**Bottom line:** expect ~$30–50/month in fixed infra cost for the first year.

---

## 9. What the platform does today

For onboarding new operators or stakeholders — here is the feature list as of v1.0:

- **Visitor lifecycle** — pre-register, approve, QR check-in, host notification, check-out
- **Contractor workforce** — contractors, workers, shifts, attendance with hours + overtime + estimated pay
- **Gate operations** — face recognition entry, QR scan check-in/out, override with reason
- **Material movement** — gate passes inbound + outbound with quantity tracking
- **Watchlists + incidents** — blocklists, alerts, incident timeline
- **Compliance** — document expiries, police verification, medicals with auto-warnings
- **Reports + analytics** — 10 report families (visits, workforce, contractors, branches, hosts, materials, incidents, audit, vehicles, gate activity) with month/week/day/year + categorical grouping, drill-down, period comparison, CSV/Excel/PDF/JSON/XML export, scheduled email reports
- **Executive dashboard** — leadership view at `/executive` with KPIs, risk indicators, top performers, branch leaderboard, incident breakdown
- **Mobile app** — Expo build for hosts (approve visits, view occupancy, push notifications)
- **Kiosk** — self-service front-desk check-in (face or QR)
- **Multi-tenant** — single deployment can serve multiple organizations; Gem deploy is single-tenant

---

## 10. Where things live in the code

- `apps/api/` — NestJS API (modules grouped by domain: visitors, gate, workforce, reports, etc.)
- `apps/web/` — Next.js dashboard
- `apps/mobile/` — Expo app
- `apps/kiosk/` — Next.js kiosk
- `packages/database/` — Prisma schema + generated client
- `packages/shared/` — types and schemas shared across apps
- `packages/ui/` — design tokens + shared primitives
- `scripts/clear-demo-data.js` — destructive: wipes operational tables before reseed
- `scripts/seed-gem.js` — creates the Gem org + first super-admin

---

## 11. Things we explicitly **did not** ship

So there is no surprise:

- **Hardware integration with turnstiles / boom barriers** — not in v1.0. Available as a follow-up engagement.
- **Government API integration** (e.g. Aadhaar verification) — needs separate vendor + KYC compliance scope.
- **SAML / SSO** for enterprise IdP — currently username + password + optional TOTP only.
- **Real-time forecasting / ML anomaly detection** — what we call "Risk indicators" today are rule-based (expired medicals, aged open incidents, low compliance score). Forecasting is a separate ML engagement.

---

## 12. Sign-off

Handover delivered on `<date>` by Personify Crafters to Gem Aromatics Limited.

- Source code repo (GitHub): `<URL after creation>`
- Demo backup (zip): `AEGIS-v1.0-demo-backup.zip` on the handover drive
- Demo backup (git tag): `v1.0-demo` on `origin`

Signed,
Personify Crafters
