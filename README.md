# Chateauguay Adult Hockey League (CAHL)

A no-backend, GitHub Pages website for the CAHL. It shows the season schedule,
player statistics and league leaders, and includes a built-in editor for
entering weekly game stats — all without a server.

## Live site

Once GitHub Pages is enabled, the site is served at:

- **Site:** `https://<owner>.github.io/chateauguay-hockey/`
- **Stats editor:** `https://<owner>.github.io/chateauguay-hockey/admin.html`

## How it works

Everything is static. The single source of truth is [`data/season.json`](data/season.json):

```
index.html        Public site (schedule, stats, leaders, next game)
admin.html        Weekly stats entry editor
assets/
  app.css         Styles
  data.js         Shared data loading + aggregation
  site.js         Public page rendering
  admin.js        Editor logic (form, download, GitHub publish)
  logo.png        CAHL logo
data/season.json  Players, schedule and weekly game stats
```

- The public page reads `data/season.json`, rolls each week's stat lines up
  into per-player totals (GP / Goals / Assists / Points), ranks them, and
  highlights the next upcoming game automatically from today's date.
- The **stats editor** (`admin.html`) lets you pick a week, mark who played,
  and enter goals and assists. It then either publishes the updated
  `data/season.json` directly to GitHub or lets you download it to commit.

## Entering weekly stats

1. Open `admin.html`.
2. Choose the game week and enter each player's goals/assists.
3. Click **Apply week to season**.
4. Publish one of two ways:
   - **Publish to GitHub** (recommended, automated): paste a fine-grained
     personal access token with **Contents: Read and write** on this repo.
     Committing `data/season.json` triggers the deploy workflow and the live
     site updates in a minute or two. The token is stored only in your browser.
   - **Download season.json**: commit the downloaded file to `data/season.json`
     yourself.

## Deployment (automated)

`.github/workflows/deploy.yml` deploys the repository root to GitHub Pages on
every push to `master`. To turn it on once:

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages → Build and deployment** and set
   **Source: GitHub Actions**.

After that, every stats update — whether committed by hand or published from
the editor — redeploys the site automatically.
