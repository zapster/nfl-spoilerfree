# NFL Spoiler-Free

A dependency-free browser app for browsing NFL regular-season games without
revealing results by default.

## Legal and Contact

NFL Spoiler-Free is an unofficial personal hobby project, offered free of charge
for enjoyment and not operated for profit. It is not affiliated with, endorsed
by, or sponsored by the NFL, any NFL club, ESPN, or nflverse.

NFL and team names, logos, and other marks belong to their respective rights
holders (the NFL and/or its clubs, as applicable). They are used only to identify
the teams discussed here; this project claims no ownership of them. Schedule and
team metadata are sourced from nflverse releases and published via
[`zapster/nfl-spoilerfree-data`](https://github.com/zapster/nfl-spoilerfree-data).
The nflverse-data contributors' dataset is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and is attributed
below. The app uses third-party logo URLs supplied in team metadata, preferring
ESPN-hosted images and falling back to Wikipedia-hosted images. The dataset's
license and this repository's [MIT software license](LICENSE) do not grant
rights to those separate images or marks; their rights remain with their
respective owners.

For questions or corrections, please open a
[GitHub issue](https://github.com/zapster/nfl-spoilerfree/issues). Issues are
public. For a private concern, including a rights-related matter, use the contact
information on [zapster.cc](https://zapster.cc/). I welcome reports and will
review concerns in good faith and work to resolve them.

## Contents

- `PLAN.md` - product and implementation plan
- `DECISIONS.md` - durable product and architecture decisions
- `index.html`, `app.js`, `styles.css` - data-backed site
- `favicon.svg` - original shield-and-football browser icon
- `data/fixtures/2025-mid-week-7/` - source-compatible test resources
- `scripts/prepare_mid_week7_fixture.py` - regenerate the test snapshot

## Review

The production app is `index.html`; it has no build step or external JavaScript
dependencies and loads its data from the public dataset described below.

The season picker lists seasons with regular-season data in the manifest,
newest first. The newest available season is selected on first use; later visits
restore the user's saved selection when it is still available. The app renders
regular-season games and spoiler-safe standings for the selected season. Scores
remain hidden until revealed individually or for a whole week. Revealed game
selections persist in season-specific `localStorage`; the **Manage data** dialog
exports and imports those selections, resets reveals and the saved season
choice, and can clear the downloaded-data cache. JSON backups do not include the
downloaded schedule or scores. Schedule controls can reveal or hide all
completed results for a week or the entire season. Team names and logos open a
dialog listing that team's regular-season games.

## Data Source and Cache

The app reads the public, static dataset published by
[`zapster/nfl-spoilerfree-data`](https://github.com/zapster/nfl-spoilerfree-data)
through GitHub Pages:

- Manifest: <https://zapster.github.io/nfl-spoilerfree-data/manifest.json>
- Selected season's games CSV: resolved from
  `seasons["<year>"].path` in the manifest
- Team metadata CSV: resolved from the `teams.path` entry in the manifest

Each key in the manifest's `seasons` object identifies an available season; the
app lists seasons with regular-season records and resolves each selected
season's hash-versioned CSV path and SHA-256 digest from that entry. The
published game snapshots retain the nflverse schema and include all game types;
the app filters each snapshot to `REG` games. Team metadata may include
historical teams, so the app displays only teams participating in the selected
season's regular-season schedule. Postseason games are not currently shown.

The data repository publishes snapshots generated from the public nflverse
releases for
[game schedules and results](https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv)
and
[team names, divisions, colors, and logos](https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv).
The published Pages resources allow cross-origin browser reads. The upstream
dataset is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
attribution: **nflverse-data contributors**,
<https://github.com/nflverse/nflverse-data>.

On first use, the browser fetches the manifest and the selected season's game
and team CSVs, then stores the manifest and per-season snapshots in IndexedDB.
The selected season is a small `localStorage` preference, separate from the
data cache and reveal selections. A cached manifest is reused for up to one
hour, then revalidated on page load (with the cached manifest as an offline
fallback). CSVs are downloaded only when their published digest changes. A
cached season snapshot is shown while changed files refresh, and remains
available if a refresh fails or the browser is offline. If IndexedDB is
unavailable, the app still attempts a normal network load. The downloaded
source cache is not included in JSON backups. **Clear cache** removes the
manifest and all per-season snapshots from IndexedDB; **Reset saved selections**
removes reveal selections and the saved season preference from local storage.
Using the app after clearing its cache will download and cache data again as
needed.

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
