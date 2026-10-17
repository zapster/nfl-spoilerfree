import assert from "node:assert/strict";
import test from "node:test";
import { recordsBeforeGames } from "../schedule-records.mjs";

function game(id, awayTeam, homeTeam, awayScore, homeScore) {
  const final = awayScore !== null && homeScore !== null;
  return {
    id,
    awayTeam,
    homeTeam,
    awayScore,
    homeScore,
    status: final ? "final" : "scheduled",
  };
}

test("shows only revealed earlier results and marks records partial", () => {
  const games = [
    game("known-win", "A", "B", 24, 17),
    game("hidden-loss", "A", "C", 10, 21),
    game("next-game", "A", "B", null, null),
  ];
  const records = recordsBeforeGames(games, new Set(["known-win"]));

  assert.deepEqual(records.get("known-win").A, {
    wins: 0, losses: 0, ties: 0, hiddenGames: 0,
  });
  assert.deepEqual(records.get("hidden-loss").A, {
    wins: 1, losses: 0, ties: 0, hiddenGames: 0,
  });
  assert.deepEqual(records.get("next-game").A, {
    wins: 1, losses: 0, ties: 0, hiddenGames: 1,
  });
});

test("counts revealed ties and losses without counting scheduled games", () => {
  const games = [
    game("tie", "A", "B", 20, 20),
    game("scheduled", "A", "C", null, null),
    game("loss", "A", "D", 14, 17),
    game("next", "A", "B", null, null),
  ];
  const records = recordsBeforeGames(games, new Set(["tie", "loss"]));

  assert.deepEqual(records.get("next").A, {
    wins: 0, losses: 1, ties: 1, hiddenGames: 0,
  });
});
