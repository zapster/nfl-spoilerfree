# NFL Games-of-the-Week Data Source

## Goal

Build a web page that displays NFL games for the **current/running NFL
season**, grouped by week, with support for hiding or revealing game
results. Real-time updates are **not required**.

## Recommended data source

Use **nflverse** game-level NFL data.

-   Project: nflverse
-   Data: game schedules/results
-   Useful fields include:
    -   season
    -   week
    -   game date/time
    -   home team
    -   away team
    -   home score
    -   away score
    -   game/status metadata
-   nflverse also provides play-by-play data, but that is unnecessary
    for this use case.

Official project/data resources:

-   https://github.com/nflverse
-   https://github.com/nflverse/nflverse-data
-   https://nflreadpy.nflverse.com/ (Python interface)
-   https://nflreadr.nflverse.com/ (R interface)

## Suggested architecture

Fetch the current season's schedule/results periodically rather than
relying on a realtime API.

``` text
NFL data source
      |
      v
Current-season games
      |
      v
Filter/group by week
      |
      v
Web page
      |
      +--> Show results
      |
      +--> Hide results
```

A daily refresh, build-time refresh, or manual refresh is sufficient if
realtime scores are not required.

## Data model

A minimal application model could look like:

``` js
{
  season: 2026,
  week: 1,
  date: "2026-09-13T13:00:00",
  homeTeam: "CAR",
  awayTeam: "CHI",
  homeScore: null,
  awayScore: null,
  status: "scheduled"
}
```

After the game is completed:

``` js
{
  season: 2026,
  week: 1,
  date: "2026-09-13T13:00:00",
  homeTeam: "CAR",
  awayTeam: "CHI",
  homeScore: 24,
  awayScore: 17,
  status: "final"
}
```

## Current-season filtering

Only retain the running NFL season.

Avoid hard-coding the season permanently:

``` js
const season = getCurrentNFLSeason();
```

Then filter the downloaded data to that season.

This lets the application continue working when the next NFL season
begins.

## Games-of-the-week display

Group games by NFL week:

``` text
WEEK 1

Cowboys       @ Giants
Bills         @ Texans
Bears         @ Panthers

WEEK 2

...
```

The exact presentation is a UI decision; the underlying data should
contain both future and completed games.

## Result/spoiler handling

Keep scores in the data even when they are hidden from users.

For example:

``` text
Show results: ON

Patriots  10 — 13  Seahawks
```

When disabled:

``` text
Show results: OFF

Patriots       —       Seahawks
```

This is preferable to deleting or omitting completed scores from the
data. A client-side display preference can control whether scores are
rendered.

## Realtime requirement

Realtime functionality is unnecessary for this project.

A periodic data update is sufficient:

-   Fetch once per day
-   Fetch whenever the site is rebuilt
-   Or refresh manually

The page can then show:

-   future games with scheduled dates/times
-   completed games with their final scores
-   the current season only

## API vs. dataset

For this particular application, a static/periodically refreshed dataset
is likely simpler than a realtime sports API.

If the application later needs live scores, play-by-play, or automatic
in-game updates, an API designed for live sports data can be evaluated
separately.

## Implementation checklist

-   [ ] Select the nflverse game-level schedule/results dataset.
-   [ ] Fetch or download the current NFL season.
-   [ ] Filter out previous seasons.
-   [ ] Normalize team/date/status fields for the application's data
    model.
-   [ ] Group games by NFL week.
-   [ ] Display future games without scores.
-   [ ] Store completed-game scores.
-   [ ] Add a `Show results` UI toggle.
-   [ ] Hide scores in the presentation layer rather than removing them
    from the data.
-   [ ] Set up periodic data refreshes.
-   [ ] Make the current-season calculation dynamic so the application
    rolls into future seasons automatically.

## Important design decision

Treat **data availability** and **result visibility** as separate
concerns:

``` text
Game data:
  contains scores when available

UI preference:
  determines whether users see those scores
```

That gives the site spoiler protection without requiring a second data
source or special handling of completed games.
