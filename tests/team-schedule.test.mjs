import assert from "node:assert/strict";
import test from "node:test";
import { teamScheduleByWeek } from "../team-schedule.mjs";

function game(id, week, awayTeam, homeTeam) {
  return { id, week, awayTeam, homeTeam };
}

test("includes every league week and leaves the team's bye week empty", () => {
  const games = [
    game("week-3-team", 3, "D", "A"),
    game("week-1-team", 1, "A", "B"),
    game("week-1-other", 1, "C", "D"),
    game("week-2-other", 2, "B", "C"),
  ];

  assert.deepEqual(teamScheduleByWeek(games, "A").map(({ week, games: weekGames }) => ({
    week,
    teamGameIds: weekGames.map(({ id }) => id),
  })), [
    { week: 1, teamGameIds: ["week-1-team"] },
    { week: 2, teamGameIds: [] },
    { week: 3, teamGameIds: ["week-3-team"] },
  ]);
});
