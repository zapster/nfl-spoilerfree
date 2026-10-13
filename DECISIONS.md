# Project Decisions

This file records product and implementation decisions for the current app.

## Product Structure

- The app provides Schedule and Standings views for the selected season.
- Only regular-season games are currently shown; postseason views are not
  implemented.
- Standings are grouped by AFC/NFC conference and division.
- The regular-season schedule renders every regular-season week.
- The current week is expanded by default; all other weeks start collapsed as
  compact clickable banners.
- Determine the current week from published game dates in the `America/New_York`
  time zone, independent of whether any results are final. Do not label a week
  current before the season's first game date or after its final game date.
- Outside the season's date range, expand and scroll to the opening week before
  the season, or the final week after it, without a current-week label.
- Interpret published `gameday` and `gametime` values together in
  `America/New_York`, as specified by the nflverse schedule data dictionary.
  Present known kickoffs and their weekday/date labels in the browser's default
  time zone and locale; week date ranges use those local kickoff dates. Keep
  games without a known kickoff time as `Time TBD` and retain their published
  date for date labels. This presentation conversion does not change the
  New York-based current-week calculation above.
- Entering the Schedule view scrolls to the current week.
- Week expansion state is kept in memory across renders, but not persisted.
- A `Manage data` action beside the season picker opens data import, export, and
  reset controls.

## Spoiler Behavior

- Scores are loaded with game data but hidden by default.
- Each completed game has its own centered reveal/hide toggle, affecting only
  that game's score.
- A per-week `Reveal all` control reveals every completed result in that week;
  scheduled games remain untouched.
- The schedule has a season-wide `Reveal all` / `All revealed` toggle for all
  completed games; scheduled games remain untouched.
- Revealed game IDs persist in versioned `localStorage` keys scoped by season.
- Restore only saved IDs that match currently completed games; new and scheduled
  games remain hidden until revealed.
- If local storage is unavailable or invalid, reveal/hide still works in memory.
- Spoiler protection prevents accidental display, not deliberate inspection of
  browser memory, storage, or developer tools.

## User Data Management

- Export a versioned JSON backup containing revealed game IDs grouped by season;
  do not include scores or downloaded NFL data.
- Import merges and deduplicates revealed IDs with existing selections.
- Only IDs matching completed games in the loaded season are restored as
  revealed.
- Reset asks for confirmation and clears this app's reveal selections across all
  seasons and its saved season preference, not unrelated browser storage.
- Clear cache removes the cached manifest and all season snapshots from
  IndexedDB without changing reveal selections or the current page's in-memory
  data.

## Team Game Drilldown

- Clicking a team's identity in Schedule or Standings opens a shared nearly
  full-screen dialog on desktop and mobile.
- The dialog lists that team's regular-season games grouped by week; postseason
  games are excluded.
- Mark the current week in the team's game list when that week is present.
- Open the list scrolled to the current week, or the nearest prior team week
  during a bye. Outside the season date range, use the opening or final focus
  week without marking it current.
- Per-game score controls use the same persisted reveal state as the main views.
- Closing the dialog returns to the originating view, scroll position, and team
  control.

## Partial-Result Standings

- Standings are calculated only from completed games whose results the user has
  revealed.
- Winning percentage gives revealed ties half credit using
  `(wins + 0.5 * ties) / gamesPlayed`.
- A partial record must be labeled as a known or revealed record, not presented
  as the team's complete actual record.
- If the latest completed game is unrevealed, show `?` for the streak.
- If the latest result is known but an unrevealed game prevents confirming where
  the streak began, show `W?` or `L?` instead of a numeric streak.
- Show a numeric streak only when its boundary is known: the preceding game is
  revealed as the opposite result, or the streak reaches the start of the
  season.
- For chronological results `? W W`, show `W?`, not `W2`, because the first
  result could extend or break the visible streak.

## Data Loading and Caching

- Show a first-use notice describing `localStorage` preferences, the IndexedDB
  data cache, external resource requests, and the absence of analytics or
  advertising trackers. Wait for Continue before reading saved preferences or
  loading app data; Leave exits. Remember acceptance in `localStorage` when
  available; if storage is unavailable, allow the current visit and show the
  notice again next time. Per the owner's product decision, there is no in-app
  cache opt-out. Resetting saved selections does not remove the notice
  acknowledgment.
- Keep the deployed app static. Read immutable, hash-versioned season and team
  CSV snapshots from the published data repository; source URLs and attribution
  are in `README.md`.
- Build the season picker from manifest entries with regular-season records,
  newest first. Default to the newest season and persist the selection.
- Load only the selected season and filter its game CSV to regular-season
  (`REG`) games. Derive standings rather than persisting them.
- Cache the manifest and season CSVs in IndexedDB; keep the season preference
  and revealed game IDs in separate `localStorage` keys.
- Revalidate the manifest hourly and refresh CSVs when their digest changes.
  Use the digest as a cache version identifier, not as client-side verification
  of downloaded bytes. Keep cached snapshots usable offline or after a failed
  refresh.
- Use `cache: "no-store"` for source requests, allow users to clear the cache,
  and fall back to network loading if IndexedDB is unavailable.

## Team Presentation

- Use logo URLs from nflverse team metadata where available.
- Keep team identity available through text and team-color abbreviations when an
  image is unavailable.

## Open Decisions

- Whether team logo assets should eventually be mirrored locally.
- Whether playoff data should be added to the production UI next.
