# Ledger — Flip Tracker

A small, private business tracker for buying and reselling items. Log what
you paid, what it sold for, and watch your monthly goal fill up like a tank.
Built to run on Cloudflare Pages + D1, with no build step.

## What it does

- Log items: name, category, cost, sale price, dates, notes, original
  listing URL (the seller's post) and your resale listing URL
- Dashboard: this month's profit toward your goal, items sold, average
  margin, average days-to-sell
- Monthly goal that can change over time without rewriting history (raise
  it next month and last month's numbers stay exactly as they were)
- Filter items by status (sold/unsold) or category
- Clickable links back to the original and resale listings, right in the
  item list
- Password-protected with a single shared password (this is a personal
  tool for one or two people, not a multi-user system)

## One-time setup

You'll need:
- A [Cloudflare account](https://dash.cloudflare.com) (you already have one)
- [Node.js](https://nodejs.org) installed locally (to run `wrangler`, Cloudflare's CLI)
- The GitHub repo you created, cloned locally

### 1. Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
wrangler login
```

This opens a browser to authorize the CLI against your Cloudflare account.

### 2. Copy these files into your repo

Copy everything from this project into your cloned repo folder, then commit:

```bash
git add .
git commit -m "Initial ledger app"
git push
```

### 3. Create the D1 database

```bash
wrangler d1 create flip-tracker-db
```

This prints a `database_id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_DATABASE_ID`.

### 4. Run the migrations (creates the tables)

```bash
wrangler d1 execute flip-tracker-db --remote --file=./migrations/0001_init.sql
wrangler d1 execute flip-tracker-db --remote --file=./migrations/0002_add_urls.sql
```

### 5. Create the Pages project and connect it to your repo

Easiest path: go to the [Cloudflare dashboard](https://dash.cloudflare.com) →
**Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick your
repo. Use these build settings:

- **Build command:** (leave blank — there's no build step)
- **Build output directory:** `public`

### 6. Bind the D1 database to your Pages project

In the Pages project settings → **Settings** → **Functions** → **D1 database
bindings** → add a binding:

- **Variable name:** `DB`
- **D1 database:** `flip-tracker-db`

### 7. Set your password

Same Settings page → **Environment variables** → add:

- **Variable name:** `APP_PASSWORD`
- **Value:** whatever password you want to use
- Mark it as **Encrypted**

Do this for both **Production** and **Preview** environments if you want
preview deploys to also work.

### 8. Redeploy

Trigger a new deployment (push any small change, or hit "Retry deployment"
in the dashboard) so the new environment variable and D1 binding take effect.

### 9. Open it on your phone

Go to the `*.pages.dev` URL Cloudflare gives you, enter your password, and
start logging items. Add it to your home screen (Safari/Chrome: Share →
"Add to Home Screen") so it feels like an app.

## Local development (optional)

If you want to test changes locally before pushing:

```bash
wrangler pages dev public --d1=DB --binding APP_PASSWORD=yourpassword
```

## Notes on the data model

- Goals are stored per-month (`"2026-07": 1000`) so raising your target
  later doesn't change how past months are scored against their own goal.
  If a month has no explicit goal set, it carries forward the most recent
  prior month's goal automatically.
- All money fields are plain numbers (no currency formatting in the
  database) — formatting happens only in the display layer.
- There's no multi-user support or per-user accounts. Anyone with the
  password sees and can edit everything. That's intentional for now — if
  you ever bring on a partner or want separate logins, that's a bigger
  change worth doing deliberately rather than bolting on.
