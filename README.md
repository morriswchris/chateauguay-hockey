# Chateauguay Adult Hockey League (CAHL)

A no-backend, GitHub Pages website for the CAHL. It shows the season schedule,
player statistics and league leaders. Stats are entered in a **Google Sheet**;
a GitHub Action pulls the sheet, rebuilds the site's data file, and the site
redeploys automatically. No server, no login, no tokens on the site.

## Live site

Once GitHub Pages is enabled: `https://<owner>.github.io/chateauguay-hockey/`

## How it works

```
Google Sheet ──(Publish to web: CSV)──► GitHub Action (sync-stats.yml)
                                              │ rebuilds data/season.json
                                              ▼
                                        commit ──► Pages deploy ──► live site
```

- The public page (`index.html`) reads [`data/season.json`](data/season.json),
  groups stat lines by game date, computes each player's GP / Goals / Assists /
  Points, ranks them, shows the league leaders, and auto-highlights the next
  upcoming game from today's date.
- `data/season.json` is **generated** — you don't edit it by hand. It's rebuilt
  from the Google Sheet by [`scripts/build_season.py`](scripts/build_season.py).

```
index.html                     Public site
assets/{app.css,data.js,site.js,logo.png}   Styles, data helpers, rendering, logo
data/season.json               Generated data (schedule + games)
scripts/build_season.py        Sheet CSV -> season.json
.github/workflows/sync-stats.yml   Pull sheet + commit (scheduled + manual)
.github/workflows/deploy.yml       Deploy to GitHub Pages on push to master
```

## Entering stats (Google Sheet)

The **Stats** sheet uses one row per player per game. `Player` is free text —
the roster and all totals are computed from whoever appears here:

| Date | Player | Goals | Assists |
|------|--------|-------|---------|
| 2026-09-09 | Mark Lucas | 2 | 1 |
| 2026-09-09 | Ben Levesque | 3 | 0 |
| 2026-09-16 | Mark Lucas | 1 | 3 |

Dates can be `2026-09-09`, `9/9/2026`, or `Sept 9, 2026` — all are understood
and games are grouped by date.

The **Schedule** is an optional, independent sheet (it does not need to match
the stats dates):

| Week | Date | Time | Rink |
|------|------|------|------|
| 1 | 2026-09-09 | 19:45–21:15 | Kim St-Pierre |

## One-time setup

1. **Publish the sheet(s) as CSV**: in Google Sheets, `File → Share →
   Publish to web`, pick the tab, choose **CSV**, and copy the URL. Do this for
   the Stats tab (and the Schedule tab if you use one). Publishing exposes only
   *read* access to that data — edit access stays private to whoever you share
   the sheet with, which is your access control.
2. **Add the URLs as repository Variables** (not secrets):
   `Settings → Secrets and variables → Actions → Variables`:
   - `STATS_CSV_URL` — required
   - `SCHEDULE_CSV_URL` — optional (omit to keep the schedule in `season.json`)
3. **Enable Pages**: `Settings → Pages → Build and deployment → Source: GitHub
   Actions`.

## Updating the site

The site refreshes from the sheet on any of these — each re-pulls the sheet,
rebuilds `data/season.json`, and (when it changed) redeploys:

- **Every 24 hours:** once daily at **16:00 UTC** — 11am US Eastern in winter
  (EST) / 12pm in summer (EDT). GitHub cron is UTC-only, so the wall-clock time
  shifts by an hour across daylight saving.
- **On every merge to `master`:** any push rebuilds from the current sheet.
- **On demand:** `Actions → Sync stats from Google Sheet → Run workflow` pulls
  immediately after you finish entering a game.

The sync commits only when the numbers changed, so unchanged runs don't create
commits.

To change the cadence, edit the `cron` lines in
[`.github/workflows/sync-stats.yml`](.github/workflows/sync-stats.yml).
