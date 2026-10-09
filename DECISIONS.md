# Project Decisions

This file records decisions made during planning and mockup work. `PLAN.md`
contains the broader implementation plan.

## Product Structure

- Regular season and playoffs are distinct top-level views.
- The regular-season view has Schedule and Standings subviews.
- Standings are grouped by AFC/NFC conference and division.
- The regular-season schedule renders every regular-season week.
- The current week is expanded by default; all other weeks start collapsed as
  compact clickable banners.
- Entering the Schedule view scrolls to the current week.
- Week expansion state is kept in memory across renders, but not persisted.
- A `Manage data` action beside the season picker opens data import, export, and
  reset controls.
- The playoff view is grouped by playoff round, not regular-season week.

## Spoiler Behavior

- Scores are loaded with game data but hidden by default.
- Each completed game has its own centered reveal/hide toggle.
- A per-week `Reveal all` control may reveal every completed result in that
  week; scheduled games remain untouched.
- Revealing one game must not reveal any other game.
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
- Reset asks for confirmation and clears only this app's saved data across all
  seasons, not unrelated browser storage.

## Team Game Drilldown

- Clicking a team's identity in Schedule or Standings opens a shared nearly
  full-screen dialog on desktop and mobile.
- The dialog lists that team's regular-season games grouped by week; postseason
  games are excluded.
- Mark the current week in the team's game list when that week is present.
- Open the list scrolled to the current week, or the nearest prior team week
  during a bye.
- Per-game score controls use the same persisted reveal state as the main views.
- Closing the dialog returns to the originating view, scroll position, and team
  control.

## Partial-Result Standings

- Standings are calculated only from completed games whose results the user has
  revealed.
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

- The deployed site should remain static HTML and JavaScript.
- The browser fetches nflverse data directly; page regeneration is not needed
  when scores change.
- Schedule and result data come from the nflverse schedules release:
  https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv
- Team names, divisions, colors, and logos come from the nflverse teams
  metadata release:
  https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv
- Planned: use IndexedDB for structured persistent data once caching is
  implemented.
- Results and game status have an initial one-hour TTL.
- Schedule metadata and team metadata have an initial six-month TTL.
- Standings are derived from current results rather than persisted initially.
- Use stale-while-revalidate behavior and retain stale cached data when a
  refresh fails or the browser is offline.
- Direct browser loading depends on the selected nflverse endpoints allowing
  CORS requests.

## Team Presentation

- Use team logos where available.
- Keep the team-color abbreviation box as a logo fallback.
- Team identity must remain available as text when a logo fails to load.
- The current standalone mockup uses preview ESPN CDN logo URLs; production
  data should use the logo URLs from nflverse team metadata.

## Current Mockup

- File: `regular-season-mockup.html`
- The mockup starts on Week 7.
- Week 6 and Week 8 are included as hidden examples that can be expanded.
- Schedule and Standings are the primary navigation at the top.
- A season dropdown is aligned to the right of that navigation.
- There is no top bar or introductory hero content.
- The mockup uses sample data and is not connected to live nflverse data.

## Current Implementation Handoff

- The production entry point is `index.html`; the two `*-mockup.html` files
  remain static design references.
- The implementation is dependency-free static HTML, CSS, and JavaScript.
- `app.js` fetches the configured games and team CSVs directly, keeps normalized
  data in memory, and persists revealed game IDs in season-scoped local storage.
  There is no IndexedDB, data caching, refresh policy, or automated test suite
  yet.
- The `Manage data` dialog exports/imports revealed-game selections as JSON and
  can reset this app's saved reveal selections across seasons.
- The current URLs point at the local 2025 fixture under
  `data/fixtures/2025-mid-week-7/`. To test live NFLverse data, change only
  `DATA.gamesUrl` and `DATA.teamsUrl` in `app.js`, subject to source CORS.
- The fixture represents immediately after the Week 7 Thursday game. The
  browser therefore identifies Week 7 as current from the latest completed
  regular-season week.
- Scores are hidden by default. Individual scores toggle reveal/hide; the
  week control says `Reveal all` until all completed games are visible, then
  says `All revealed` while remaining clickable to hide them.
- Standings use only revealed results. Teams with hidden completed results are
  marked as partial with an asterisk and highlighted rows. Streaks use `?` or
  `W?`/`L?` when their boundary cannot be known safely.
- Start local development from the repository root with
  `python3 -m http.server 8787`, then open `http://127.0.0.1:8787/`.

## Non-Goals

- No realtime or in-game score polling.
- No play-by-play data.
- No runtime application server requirement.
- No manual backup workflow for the upstream NFL schedule or score data; JSON
  backups cover user reveal selections only.

## Open Decisions

- Exact current-season boundary policy.
- Basic standings ordering versus official NFL tie-breakers.
- Whether team logo assets should eventually be mirrored locally.
- Whether IndexedDB caching should be added and how stale data should be
  presented.
- Whether playoff data should be added to the production UI next.
