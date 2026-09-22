# NFL Spoiler-Free

A simple mockup for browsing NFL regular-season games without revealing
results by default.

## Contents

- `PLAN.md` - product and implementation plan
- `DECISIONS.md` - durable product and architecture decisions
- `regular-season-mockup.html` - standalone schedule-view mockup
- `index.html`, `app.js`, `styles.css` - initial data-backed site
- `data/fixtures/2025-mid-week-7/` - source-compatible test resources
- `scripts/prepare_mid_week7_fixture.py` - regenerate the test snapshot

## Review

Open `regular-season-mockup.html` directly in a browser. It has no build step
or external JavaScript dependencies. The mockup centers Week 7, lets you
expand Week 6 or Week 8, and reveals scores one game at a time.

The mockup uses sample data and preview logo URLs. It is not yet connected to
the live nflverse data source.

The initial site fetches the two configured CSV resources directly, normalizes
them in memory, and renders every regular-season week with the current week
marked alongside spoiler-safe standings. The current week is open by default;
other weeks are compact clickable banners. It does not cache data yet. Scores
remain hidden until their individual reveal buttons or a week-level `Reveal
all` button are used, and can be hidden again; standings count only revealed
results.

## Local Website and NFLverse Fixture

The prepared fixture represents the 2025 season immediately after the Week 7
Thursday game on October 16, 2025. It contains the regular-season schedule,
final scores through that cutoff, and scheduled games with blank result fields
after the cutoff. Team logos remain external URLs from the team metadata.

Start the local static server from the repository root:

```sh
python3 -m http.server 8787
```

The website is then available at:

- `http://127.0.0.1:8787/regular-season-mockup.html`

The fixture resources are served from the same origin:

- `http://127.0.0.1:8787/data/fixtures/2025-mid-week-7/games.csv`
- `http://127.0.0.1:8787/data/fixtures/2025-mid-week-7/teams_colors_logos.csv`

The fixture manifest at `data/fixtures/2025-mid-week-7.manifest.json` is
provenance metadata for the test data and is not required by the application.
The unmodified downloads are retained under `data/source/` for regeneration.

To regenerate after downloading newer source files:

```sh
python3 scripts/prepare_mid_week7_fixture.py
```
