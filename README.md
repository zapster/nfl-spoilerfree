# NFL Spoiler-Free

A dependency-free browser app for browsing NFL regular-season games without
revealing results by default.

## Public Website

The app is published at <https://zapster.github.io/nfl-spoilerfree/>.

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
respective owners. The browser favicon is an original design and does not use
the official NFL shield.

Bug reports, feature requests, and missing features are tracked in public
[GitHub Issues](https://github.com/zapster/nfl-spoilerfree/issues), so do not
include sensitive information. For a private concern, including a rights-related
matter, use the contact information on [zapster.cc](https://zapster.cc/). I
welcome reports and will review concerns in good faith and work to resolve them.

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
season's regular-season schedule. The digest is used as a cache version identifier;
the browser does not independently recompute it to verify downloaded CSV bytes.
Postseason games are not currently shown.

The data repository publishes snapshots generated from the public nflverse
releases for
[game schedules and results](https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv)
and
[team names, divisions, colors, and logos](https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv).
The published Pages resources allow cross-origin browser reads. The upstream
dataset is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
attribution: **nflverse-data contributors**,
<https://github.com/nflverse/nflverse-data>.

The nflverse schedule is not a live scoreboard: its schema has no game-status,
quarter, or clock fields. The [schedule data dictionary](https://nflreadr.nflverse.com/articles/dictionary_schedules.html)
describes score fields but does not define an in-progress state. Scores can remain
empty while a game is underway, so the schema does not distinguish an unstarted
game from an ongoing one. This app marks a game **Final** only when both scores
are present; if either score is missing, it displays the game as **Scheduled**.
As a result, an ongoing game may appear scheduled until nflverse publishes its
scores. nflverse says its [schedule data updates every five minutes](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html#nflverse-gameschedule-data)
during the season, but this project's publisher checks for upstream changes
hourly, and the browser may reuse a cached manifest for up to an hour.

The nflverse schedule data dictionary specifies that `gametime` is a 24-hour
kickoff time in Eastern Time, regardless of game location. The app interprets
`gameday` and `gametime` together in `America/New_York`, then displays known
kickoffs, weekdays, and week date ranges in the browser's default time zone and
locale. Games without a published kickoff time remain `Time TBD`; their source
date is retained for date labels. Current-week detection continues to use
`America/New_York`.

Before reading saved app preferences or loading NFL data on first use, the app
shows a browser-storage notice. **Continue to app** saves an acknowledgment in
`localStorage` when available and proceeds; **Leave page** exits without loading
app data. If the acknowledgment cannot be saved, the notice may reappear on a
future visit. The acknowledgment remains until this site's browser data is
cleared; **Reset saved selections** does not clear it. The notice explains the
storage and external requests. The app does not use analytics or advertising
trackers; requests to GitHub Pages and logo hosts still expose normal connection
information, such as the visitor's IP address, to those hosts.

After continuing, the browser fetches the manifest and selected season's game
and team CSVs, then stores the manifest and per-season snapshots in IndexedDB.
The selected season and revealed-game choices are stored in app-specific
`localStorage` keys, separate from the IndexedDB cache. Saved preferences remain
until reset or site data is cleared. A cached manifest is reused for up to one
hour, then revalidated on page load; if revalidation fails, the cached manifest
is used as an offline fallback. CSVs are downloaded when their published digest
changes. A cached season snapshot is shown while changed files refresh, and
remains available if a refresh fails or the browser is offline. If IndexedDB is
unavailable, the app still attempts a normal network load. The downloaded source
cache is not included in JSON backups. **Clear cache** removes the manifest and
all per-season snapshots from IndexedDB; **Reset saved selections** removes
reveal selections and the saved season preference from local storage but leaves
the notice acknowledgment intact. Using the app after clearing its cache will
download and cache data again as needed.

## Local Website

Start the local static server from the repository root:

```sh
python3 -m http.server 8787
```

The website is then available at:

- `http://127.0.0.1:8787/`
