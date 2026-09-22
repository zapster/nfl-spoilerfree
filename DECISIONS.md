# Project Decisions

This file records decisions made during planning and mockup work. `PLAN.md`
contains the broader implementation plan.

## Product Structure

- Regular season and playoffs are distinct top-level views.
- The regular-season view has Schedule and Standings subviews.
- Standings are grouped by AFC/NFC conference and division.
- The regular-season schedule is an endless week stream.
- The current week is shown first; adjacent weeks are uncovered with controls
  above and below the stream.
- The playoff view is grouped by playoff round, not regular-season week.

## Spoiler Behavior

- Scores are loaded with game data but hidden by default.
- Each completed game has its own centered reveal button.
- A per-week `Reveal all` control may reveal every completed result in that
  week; scheduled games remain untouched.
- Revealing one game must not reveal any other game.
- Reveal state resets on page load initially.
- Spoiler protection prevents accidental display, not deliberate inspection of
  browser memory, storage, or developer tools.

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
- Use IndexedDB for structured persistent data.
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

## Non-Goals

- No realtime or in-game score polling.
- No play-by-play data.
- No runtime application server requirement.
- No manual backup-file workflow; Git is the source of history.

## Open Decisions

- Frontend framework and build tool for the application implementation.
- Exact current-season boundary policy.
- Basic standings ordering versus official NFL tie-breakers.
- Whether team logo assets should eventually be mirrored locally.
- Final normalized data format and browser-fetch implementation.
