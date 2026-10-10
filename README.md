# NFL Spoiler-Free

A dependency-free browser app and design mockup for browsing NFL regular-season
games without revealing results by default.

## Contents

- `PLAN.md` - product and implementation plan
- `DECISIONS.md` - durable product and architecture decisions
- `regular-season-mockup.html` - standalone schedule-view mockup
- `index.html`, `app.js`, `styles.css` - data-backed site
- `favicon.svg` - original shield-and-football browser icon
- `data/fixtures/2025-mid-week-7/` - source-compatible test resources
- `scripts/prepare_mid_week7_fixture.py` - regenerate the test snapshot

## Review

Open `regular-season-mockup.html` directly in a browser to review the standalone
design mockup. The production app is `index.html`; it has no build step or
external JavaScript dependencies and loads its data from the public dataset
described below.

The app currently loads only the 2025 season. It filters the source data to
regular-season games, marks the latest completed week as current, and renders
spoiler-safe standings. Scores remain hidden until revealed individually or
for a whole week. Revealed game selections persist in season-specific
`localStorage`; the **Manage data** dialog exports, imports, and resets those
selections. JSON backups do not include the downloaded schedule or scores.
Team names and logos open a dialog listing that team's regular-season games.

## Data Source and Cache

The app reads the public, static dataset published by
[`zapster/nfl-spoilerfree-data`](https://github.com/zapster/nfl-spoilerfree-data)
through GitHub Pages:

- Manifest: <https://zapster.github.io/nfl-spoilerfree-data/manifest.json>
- 2025 games CSV: resolved from the `seasons["2025"].path` entry in the manifest
- Team metadata CSV: resolved from the `teams.path` entry in the manifest

The manifest supplies the current hash-versioned CSV paths and SHA-256 digests.
The published game snapshot retains the nflverse schema and includes all game
types; this app filters it to 2025 `REG` games only. Team metadata may include
historical teams, so the app displays only teams participating in the selected
season's regular-season schedule. Other seasons and postseason games are not
currently shown.

The data repository publishes snapshots generated from the public nflverse
releases for
[game schedules and results](https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv)
and
[team names, divisions, colors, and logos](https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv).
The published Pages resources allow cross-origin browser reads. The upstream
dataset is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
attribution: **nflverse-data contributors**,
<https://github.com/nflverse/nflverse-data>.

On first use, the browser fetches the manifest and the 2025 game and team CSVs,
then stores the snapshot in IndexedDB. Later visits render the cached snapshot
immediately. When a cached snapshot is at least one hour old, the app
revalidates the manifest in the background and downloads a CSV only if its
published digest changed. If refresh fails or the browser is offline, the last
usable cached snapshot remains available. If IndexedDB is unavailable, the app
still attempts a normal network load. The downloaded source cache is separate
from reveal selections and is not included in JSON backups or cleared when
resetting those selections.

## Local Website and Test Fixture

Start the local static server from the repository root:

```sh
python3 -m http.server 8787
```

The website is then available at:

- `http://127.0.0.1:8787/`

The files in `data/fixtures/2025-mid-week-7/` are a test snapshot taken just
after the Week 7 Thursday game on October 16, 2025. They are not used by the
application. Their manifest records fixture provenance, and the unmodified
source downloads are retained under `data/source/` for regeneration.

To regenerate after downloading newer source files:

```sh
python3 scripts/prepare_mid_week7_fixture.py
```
