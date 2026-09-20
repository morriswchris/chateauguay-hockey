#!/usr/bin/env python3
"""Build data/season.json from Google Sheet CSV exports.

Reads two "Publish to web -> CSV" URLs (no credentials needed) from the
environment and regenerates data/season.json:

  STATS_CSV_URL     columns: Date, Player, Goals, Assists  (Player is free text)
  SCHEDULE_CSV_URL  columns: Date, Time, Rink [, Week, Note]  (optional; independent)

Games are grouped by date; the roster and all totals are computed on the site
from whichever players appear here. Meta (season label, rink, etc.) and — when
no schedule URL is set — the existing schedule are preserved from the current
season.json.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEASON_PATH = os.path.join(ROOT, "data", "season.json")

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun",
     "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MON_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def norm_key(k):
    return re.sub(r"[^a-z0-9]", "", (k or "").lower())


def pick(row, *names):
    for n in names:
        if n in row and row[n] not in (None, ""):
            return row[n]
    return ""


def parse_date(text):
    """Return a datetime.date from many common spreadsheet date formats, or None."""
    s = (text or "").strip()
    if not s:
        return None
    # Drop a leading weekday word only ("Wed, Sept 9, 2026" -> "Sept 9, 2026"),
    # never a month name.
    s2 = s
    lead = re.match(r"^([A-Za-z]+),?\s+", s)
    weekdays = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    if lead and lead.group(1)[:3].lower() in weekdays:
        s2 = s[lead.end():]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%d-%b-%Y", "%d-%b-%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    # Month-name forms: "Sept 9, 2026", "September 9 2026"
    m = re.match(r"([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})", s2)
    if m:
        mon = MONTHS.get(m.group(1)[:3].lower())
        if mon:
            try:
                return datetime(int(m.group(3)), mon, int(m.group(2))).date()
            except ValueError:
                return None
    return None


def display_date(d, fallback=""):
    if not d:
        return fallback
    return "%s, %s %d, %d" % (WEEKDAYS[d.weekday()], MON_ABBR[d.month - 1], d.day, d.year)


def to_int(v):
    try:
        return int(float(str(v).strip()))
    except (ValueError, TypeError):
        return 0


def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "cahl-sync/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8-sig")
    def cell(v):
        if isinstance(v, list):            # extra unmapped columns land in a list
            v = " ".join(x for x in v if x)
        return (v or "").strip()
    rows = []
    for r in csv.DictReader(io.StringIO(raw)):
        rows.append({norm_key(k): cell(v) for k, v in r.items() if k is not None})
    return rows


def build_games(rows):
    games = {}          # iso -> {date, iso, players: {name: {g, a}}}
    for r in rows:
        name = pick(r, "player", "name", "playername").strip()
        date_raw = pick(r, "date", "gamedate", "game")
        if not name or not date_raw:
            continue
        d = parse_date(date_raw)
        iso = d.isoformat() if d else date_raw.strip()
        disp = display_date(d, date_raw.strip())
        g = games.setdefault(iso, {"date": disp, "iso": iso if d else "", "players": {}})
        p = g["players"].setdefault(name, {"g": 0, "a": 0})
        p["g"] += to_int(pick(r, "goals", "g", "goal"))
        p["a"] += to_int(pick(r, "assists", "a", "assist", "ast"))

    out = []
    for iso in sorted(games.keys()):
        g = games[iso]
        stats = [{"player": n, "g": v["g"], "a": v["a"]}
                 for n, v in sorted(g["players"].items())]
        out.append({"date": g["date"], "iso": g["iso"], "stats": stats})
    return out


def build_schedule(rows):
    out = []
    for r in rows:
        date_raw = pick(r, "date", "gamedate", "game")
        if not date_raw and not pick(r, "time"):
            continue
        d = parse_date(date_raw)
        out.append({
            "week": pick(r, "week", "wk", "gw"),
            "date": display_date(d, date_raw.strip()),
            "iso": d.isoformat() if d else "",
            "time": pick(r, "time", "faceoff") or "TBD",
            "rink": pick(r, "rink", "arena", "location", "venue") or "",
            "note": pick(r, "note", "notes"),
        })
    # Sort rows that have an ISO date; leave the rest in sheet order at the end.
    dated = [x for x in out if x["iso"]]
    undated = [x for x in out if not x["iso"]]
    dated.sort(key=lambda x: x["iso"])
    return dated + undated


def main():
    with open(SEASON_PATH, encoding="utf-8") as f:
        season = json.load(f)

    old_games = season.get("games", [])
    old_schedule = season.get("schedule", [])

    stats_url = os.environ.get("STATS_CSV_URL", "").strip()
    sched_url = os.environ.get("SCHEDULE_CSV_URL", "").strip()

    if stats_url:
        season["games"] = build_games(fetch_csv(stats_url))
        print("Loaded %d game(s) from stats sheet." % len(season["games"]))
    else:
        print("WARNING: STATS_CSV_URL not set — keeping existing games.", file=sys.stderr)

    if sched_url:
        season["schedule"] = build_schedule(fetch_csv(sched_url))
        print("Loaded %d schedule row(s) from schedule sheet." % len(season["schedule"]))
    else:
        print("SCHEDULE_CSV_URL not set — keeping existing schedule (%d rows)."
              % len(old_schedule))

    season["source"] = "google-sheet"

    # Only bump the timestamp when the real content changed, so an unchanged
    # scheduled run leaves the file byte-identical and produces no commit.
    changed = season["games"] != old_games or season["schedule"] != old_schedule
    if changed:
        season["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(SEASON_PATH, "w", encoding="utf-8") as f:
        json.dump(season, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Content changed:" , changed, "| wrote", SEASON_PATH)


if __name__ == "__main__":
    main()
