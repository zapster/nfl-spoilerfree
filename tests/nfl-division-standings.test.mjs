import assert from "node:assert/strict";
import test from "node:test";
import { sortDivisionStandings } from "../nfl-division-standings.mjs";

function team(abbreviation, nickname, wins, losses, division = "North") {
  return {
    abbreviation,
    nickname,
    conference: "AFC",
    division,
    gamesPlayed: wins + losses,
    wins,
    losses,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function game(id, awayTeam, homeTeam, awayScore, homeScore) {
  return {
    id,
    awayTeam,
    homeTeam,
    awayScore,
    homeScore,
    status: "final",
  };
}

test("uses NFL tiebreakers instead of alphabetical order for a three-team tie", () => {
  const ravens = team("BAL", "Ravens", 4, 1);
  const bengals = team("CIN", "Bengals", 3, 2);
  const browns = team("CLE", "Browns", 3, 2);
  const steelers = team("PIT", "Steelers", 3, 2);
  const teams = [ravens, bengals, browns, steelers];
  const games = [
    game("browns-win", "CLE", "BAL", 24, 17),
    game("bengals-loss", "CIN", "BAL", 17, 24),
    game("steelers-win", "PIT", "BAL", 24, 17),
    game("steelers-loss", "BAL", "PIT", 20, 17),
  ];

  const ranked = sortDivisionStandings(teams, teams, games, new Set(games.map(({ id }) => id)));

  assert.deepEqual(ranked.map(({ abbreviation }) => abbreviation), ["BAL", "CLE", "PIT", "CIN"]);
});

test("head-to-head takes precedence over division record in a two-team tie", () => {
  const browns = team("CLE", "Browns", 3, 2);
  const bengals = team("CIN", "Bengals", 3, 2);
  const steelers = team("PIT", "Steelers", 4, 1);
  const teams = [browns, bengals, steelers];
  const games = [
    game("browns-over-bengals", "CLE", "CIN", 24, 17),
    game("bengals-over-steelers-1", "CIN", "PIT", 24, 17),
    game("bengals-over-steelers-2", "CIN", "PIT", 20, 10),
    game("steelers-over-browns", "PIT", "CLE", 20, 17),
  ];

  const ranked = sortDivisionStandings(
    [bengals, browns],
    teams,
    games,
    new Set(games.map(({ id }) => id)),
  );

  assert.deepEqual(ranked.map(({ abbreviation }) => abbreviation), ["CLE", "CIN"]);
});

test("hidden game scores do not influence tiebreakers", () => {
  const browns = team("CLE", "Browns", 3, 2);
  const bengals = team("CIN", "Bengals", 3, 2);
  const ravens = team("BAL", "Ravens", 4, 1);
  const teams = [browns, bengals, ravens];
  const games = [
    game("browns-division-win", "CLE", "BAL", 24, 17),
    game("bengals-division-loss", "CIN", "BAL", 17, 24),
    // If this unrevealed result were used, head-to-head would put Cincinnati first.
    game("hidden-head-to-head", "CLE", "CIN", 17, 20),
  ];

  const ranked = sortDivisionStandings(
    [bengals, browns],
    teams,
    games,
    new Set(["browns-division-win", "bengals-division-loss"]),
  );

  assert.deepEqual(ranked.map(({ abbreviation }) => abbreviation), ["CLE", "CIN"]);
});
