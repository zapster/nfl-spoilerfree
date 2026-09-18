# NFL Spoiler-Free Games Plan

## Goal

Build a web page showing games from the current NFL season, grouped by
week, while allowing users to hide or reveal completed-game scores.

Realtime scores are not required. Periodic browser refreshes are sufficient;
the page should not need to be regenerated when source data changes.

## Current Repository State

- The repository has no application scaffold yet.
- `nfl_current_season_games_summary.md` and `PLAN.md` are the project documents.
- There are no commits or existing implementation files.
- The referenced issue URL was not publicly accessible from this workspace.

## Data Source

Use nflverse game-level schedule data.

Primary source:

https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv

Documentation:

- https://nflreadr.nflverse.com/reference/load_schedules.html
- https://nflreadr.nflverse.com/articles/dictionary_schedules.html
- https://nflreadpy.nflverse.com/

The release provides:

- `games.csv`
- `games.csv.gz`
- `games.parquet`
- R and Python-compatible formats

The CSV contains historical, current, and future games. The application
must filter it to the desired season.

### Team Metadata

nflverse also provides current-team metadata for standings and visual
identity.

Source:

https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv

Documentation:

https://nflreadr.nflverse.com/reference/load_teams.html

The teams dataset includes fields such as:

```text
team_abbr
team_name
team_id
team_nick
team_conf
team_division
team_color
team_color2
team_color3
team_color4
team_logo_wikipedia
team_logo_espn
team_wordmark
team_conference_logo
team_league_logo
team_logo_squared
```

Use this dataset for:

- Conference and division membership
- Full team names and nicknames
- Team colors in schedule and standings views
- Team logos in schedule and standings views

The application should normalize `team_conf` and `team_division` into the
standings model while retaining the source values where useful. Logos and
colors are presentation metadata and must not be required to calculate game
results or standings. Missing assets should have a text-based fallback.

When team metadata is captured as a test fixture, record its source URL,
retrieval timestamp, source revision, and generated-fixture hash alongside the
schedule fixture. Runtime cache entries should retain the source URL and
retrieval timestamp even when no generated file is produced.

## Data Delivery Strategy

The deployed site should be a static HTML/JavaScript application. The HTML
should contain only the application shell and configuration such as source
URLs, schema version, and cache policy. It should not contain the schedule,
scores, standings, or team metadata.

The browser should fetch nflverse data directly and persist normalized data in
browser storage. No page regeneration or runtime application server is
required when new scores become available.

The browser is responsible for:

- Fetching and normalizing games and scores
- Fetching and normalizing team metadata
- Calculating regular-season standings
- Switching between schedule, standings, and playoff views
- Hiding or revealing scores
- Refreshing expired data

The results toggle must not trigger a data request. It only changes how
already-loaded scores are rendered.

Scores are intentionally available in browser memory and persistent storage.
The spoiler feature prevents accidental display, not deliberate inspection
through developer tools or cache contents.

Direct browser fetching requires the selected nflverse endpoints to support
browser CORS requests. If they do not, a same-origin proxy or another
browser-accessible mirror will be needed; adding such a proxy is not part of
the initial static-site design.

### Cache Policies

Cache entries should have independent TTLs:

| Data | Initial TTL | Notes |
| --- | ---: | --- |
| Game results and status | 1 hour | Refreshes completed scores and game state |
| Schedule metadata | 6 months | Teams, dates, weeks, and game IDs |
| Team metadata and logo URLs | 6 months | Names, divisions, colors, and asset URLs |
| Derived standings | Not persisted initially | Recalculate when results change |

nflverse currently provides schedule and result fields in one game dataset.
The client may fetch and parse that dataset hourly, then split the normalized
records into schedule and result cache entries. The schedule TTL describes
how long the schedule data is trusted, not necessarily how often the source
file is downloaded.

### Persistent Browser Storage

Use `IndexedDB` as the primary persistent cache. `localStorage` is acceptable
for small preferences such as the result-visibility setting, but is
synchronous and less suitable for structured game data.

Each cache entry should include:

```js
{
  key: "games:2025:results",
  fetchedAt: "2026-09-18T20:00:00Z",
  expiresAt: "2026-09-18T21:00:00Z",
  schemaVersion: 1,
  data: []
}
```

Use a stale-while-revalidate flow:

1. Render valid cached data immediately.
2. If data is expired, render stale data while fetching a replacement.
3. Replace the cache and update the UI when the request succeeds.
4. Keep stale data available if the request fails.
5. Show the last-updated time and a non-blocking refresh error.

The browser's HTTP cache and conditional requests such as ETags may reduce
download costs, but application-level TTLs remain the source of truth for
display freshness.

Team logo URLs may initially remain remote image URLs. Those image requests
are separate from fetching team metadata. If logo availability or privacy
becomes a concern, the images can later be mirrored and cached locally.

## 2025 Test Data

The 2025 season currently contains:

- 285 games total
- 272 regular-season games
- Regular-season weeks 1 through 18
- 13 postseason games
- 6 Wild Card games
- 4 Divisional games
- 2 Conference Championship games
- 1 Super Bowl game in week 22

All 2025 games have final scores.

The source does not provide an explicit `status` column. For the completed
2025 snapshot, normalized records should use:

```text
status: "final"
```

The source data contains these core fields:

```text
game_id
season
game_type
week
gameday
weekday
gametime
away_team
away_score
home_team
home_score
```

Useful optional fields include:

```text
location
result
total
overtime
gsis
nfl_detail_id
pfr
espn
ftn
```

The 2025 data should be filtered and stored as a reproducible test fixture.
The fixture should record:

- Source URL
- Retrieval timestamp
- Source revision or release information
- Hash of the generated fixture
- Number of records
- Whether postseason games are included

Because all 2025 games are completed, synthetic scheduled games with null
scores should also be added for testing future-game behavior.

## Normalized Application Model

The UI should not depend directly on nflverse column names.

A normalized game should contain at least:

```js
{
  id: "2025_01_DAL_PHI",
  season: 2025,
  gameType: "REG",
  week: 1,
  date: "2025-09-04",
  weekday: "Thursday",
  time: "20:20",
  awayTeam: "DAL",
  homeTeam: "PHI",
  awayScore: 20,
  homeScore: 24,
  status: "final",
  overtime: false
}
```

For an unplayed game:

```js
{
  id: "test_scheduled_game",
  season: 2025,
  gameType: "REG",
  week: 18,
  date: "2026-01-04",
  weekday: "Sunday",
  time: "13:00",
  awayTeam: "CAR",
  homeTeam: "CHI",
  awayScore: null,
  homeScore: null,
  status: "scheduled",
  overtime: false
}
```

The final model should preserve scores even when the UI hides them.

A normalized team may look like:

```js
{
  abbreviation: "BUF",
  name: "Buffalo Bills",
  nickname: "Bills",
  conference: "AFC",
  division: "East",
  colors: ["#00338D", "#C60C30"],
  logoUrl: "https://..."
}
```

## Application Views

The regular season and playoffs should have distinct top-level views.

Recommended routes or equivalent view states:

- `/season/regular`
- `/season/playoffs`

The regular-season view has two subviews:

- Schedule
- Standings

The playoff view has a playoff schedule/bracket-oriented presentation and
does not use the regular-season standings layout.

Shared behavior should include:

- Season selection
- Data loading and normalization
- Result visibility preference
- Navigation and application shell
- Responsive layout primitives

The views should not require separate HTML entry points. Route-level pages or
view components are preferred so shared behavior is not duplicated.

## Regular-Season Schedule View

The schedule subview displays regular-season games grouped by weeks 1
through 18.

It should show:

- Week number
- Game date and time
- Away and home teams
- Scores when results are enabled
- Scheduled/final state

Postseason games must not appear in the regular-season schedule.

## Regular-Season Standings View

The standings subview shows current records calculated from completed
regular-season games.

Standings should be structured as:

```text
AFC
  AFC East
  AFC North
  AFC South
  AFC West

NFC
  NFC East
  NFC North
  NFC South
  NFC West
```

An initial standings table should include:

```text
Team | W | L | T | PCT | PF | PA
```

Where appropriate, the model may also include:

```text
Division record
Conference record
Games played
Streak
```

Only completed regular-season games contribute to standings. Scheduled games
and postseason games must be excluded.

The first implementation should clearly define whether standings order is:

- A basic record/PCT order, or
- An approximation of official NFL tie-breaking order

Official NFL tie-breaking is more complex than sorting by winning
percentage. If official ordering is required, it must be implemented and
tested separately rather than implied by a simple sort.

Team conference and division membership should come from a maintained team
metadata source or an explicit application mapping, not be inferred from
game results.

## Standings Data Model

A normalized team standing may look like:

```js
{
  conference: "AFC",
  division: "East",
  team: "BUF",
  gamesPlayed: 17,
  wins: 12,
  losses: 5,
  ties: 0,
  winPercentage: 0.706,
  pointsFor: 420,
  pointsAgainst: 350,
  divisionWins: 4,
  divisionLosses: 2,
  conferenceWins: 9,
  conferenceLosses: 3
}
```

Standings should be derived from normalized game data so the same fixture
can exercise both the schedule and standings views.

## Current-Season Logic

The season must not be permanently hard-coded.

A season helper should accept an explicit date and return the running NFL
season. The exact season boundary must be decided before implementation.

A reasonable initial policy is:

```js
const season = month >= 8 ? year : year - 1;
```

This treats August through December as the new season and January through
July as the previous running season.

The helper must be tested around:

- January
- July
- August
- December
- Explicit historical dates

Test data loading should allow an explicit season override so the 2025
fixture can be used regardless of the system date.

## Milestones

### Milestone 1: App Skeleton and Domain Model

Scope:

- Choose and initialize the application stack.
- Define the normalized `Game` model.
- Add the 2025 fixture and synthetic scheduled records.
- Implement current-season calculation.
- Render the regular-season schedule view.
- Render a basic conference/division standings view.

Acceptance criteria:

- The app runs locally.
- Fixture data loads without contacting nflverse.
- Games are grouped by week.
- Future and completed games are represented.
- Regular-season standings are grouped by conference and division.
- The season calculation is dynamic.
- The 2025 fixture can be selected explicitly.

### Milestone 2: Browser Data Loading

Scope:

- Fetch the nflverse schedule export from the browser.
- Filter records to a selected season.
- Normalize nflverse fields into the application model.
- Fetch and normalize the nflverse team metadata release from the browser.
- Map completed games to `status: "final"`.
- Map unplayed games to `status: "scheduled"`.
- Preserve nullable scores.
- Calculate standings from completed regular-season games.
- Handle source, parsing, CORS, and invalid-data failures visibly.

Acceptance criteria:

- Loaded records contain only the selected season.
- Team, date, time, week, and score fields are normalized.
- Every standings team has conference and division metadata.
- Schedule and standings records can resolve team names, colors, and logos.
- Missing team assets have a text-based fallback.
- Completed scores are retained.
- Unplayed scores remain null.
- Scheduled and postseason games do not affect regular-season standings.
- Invalid or incomplete source data produces a visible failure.
- A failed refresh does not silently discard valid cached data.

### Milestone 3: Season Views UI

Scope:

- Display games grouped by NFL week.
- Display matchup, date, and time information.
- Add the regular-season schedule and standings subviews.
- Group standings under AFC/NFC conferences and their divisions.
- Add the distinct playoff schedule/bracket-oriented view.
- Group playoff games by round rather than regular-season week.
- Use team names, colors, and logos consistently across game and standings
  rows.
- Support desktop and mobile layouts.
- Add accessible labels and semantic structure.

Acceptance criteria:

- All regular-season games are reachable by week.
- All playoff games are reachable by playoff round.
- Users can switch between the regular-season schedule and standings views.
- Standings display teams under the correct conference and division.
- Team identity is available through text even when a logo is unavailable.
- Matchups remain visible regardless of score visibility.
- Dates and times are displayed consistently.
- Postseason games are not confused with regular-season weeks.
- The playoff view does not display regular-season standings as its primary
  structure.
- The layout works on narrow screens.

### Milestone 4: Spoiler Protection

Scope:

- Add a `Show results` toggle.
- Hide scores in the presentation layer only.
- Keep scores in the loaded game data.
- Decide whether results are hidden by default.
- Persist the preference locally.

Acceptance criteria:

- Scores appear when results are enabled.
- Scores are not rendered when results are disabled.
- Hidden scores cannot be inferred from accessibility text or alternate
  labels.
- Scheduled games never display fabricated scores.
- The control is keyboard-accessible and clearly labeled.

### Milestone 5: Browser Cache and Refresh Behavior

Scope:

- Add the IndexedDB cache and schema versioning.
- Implement independent TTLs for results, schedules, and team metadata.
- Implement stale-while-revalidate behavior.
- Use cached data when the browser is offline or a refresh fails.
- Display data timestamps and non-blocking refresh errors.
- Document the data sources and cache behavior.

Acceptance criteria:

- The page does not need to be regenerated when source data changes.
- Results are eligible for refresh after one hour.
- Schedule and team metadata use the longer configured TTL.
- Valid cached data renders before a refresh completes.
- Refresh failures are visible without replacing valid cached data.
- The app remains usable with stale cached data when offline.

## Testing Strategy

Automated tests should cover:

- Current-season calculation.
- Explicit historical-season selection.
- Filtering out other seasons.
- nflverse-to-application field normalization.
- Team metadata normalization, including colors, logos, and divisions.
- Cache entry serialization and schema versioning.
- Independent cache TTL behavior.
- Stale-while-revalidate behavior.
- Offline and failed-refresh fallback behavior.
- Null score handling.
- Final-game status handling.
- Regular-season and postseason grouping.
- Week ordering.
- Standings record calculation from completed games.
- Conference and division grouping.
- Exclusion of scheduled and postseason games from regular-season standings.
- Standings ordering according to the selected tie-breaking policy.
- Score visibility when results are enabled.
- Score omission when results are disabled.
- Scheduled games with no scores.
- Empty or invalid dataset handling.

The exact source row count of 285 should be treated as a validation check for
the pinned 2025 snapshot, not as a permanent assumption about future source
data.

## Important Design Rules

- Keep data availability separate from result visibility.
- Do not delete scores when spoilers are hidden.
- Do not couple UI components to nflverse column names.
- Do not introduce realtime score polling.
- Do not add play-by-play data.
- Do not rely on the current calendar year alone to select the NFL season.
- Preserve the source snapshot's provenance.

## Out of Scope

- Realtime or in-game score polling
- Play-by-play data
- Push notifications
- User accounts
- Playoff predictions
- Betting lines
- Fantasy statistics
- External realtime sports APIs

## Decisions Required Before Implementation

- Frontend framework and build tool
- Deployment target
- Current-season boundary policy
- Whether postseason games are included by default
- Whether standings use basic record/PCT ordering or official NFL tie-breakers
- The source of conference and division membership metadata
- Whether results are hidden by default
- Whether the preference persists locally
- Time-zone handling for `gameday` and `gametime`
- Whether to use IndexedDB alone or a fallback for older browsers
- Whether to mirror remote team logo assets locally
- Which browser-accessible nflverse endpoints to use if CORS is unavailable
- Final normalized fixture format: JSON, JSONL, or another format
