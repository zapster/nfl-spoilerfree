import assert from "node:assert/strict";
import test from "node:test";
import { streakLabel } from "../standings-streak.mjs";

function history(...results) {
  return results.map((result) => ({ result }));
}

test("shows the last known streak when newer results are hidden", () => {
  assert.equal(streakLabel(history("L", "W", "W", null, null)), "W2?");
});

test("marks a streak uncertain when a hidden result obscures its starting boundary", () => {
  assert.equal(streakLabel(history(null, "W", "W")), "W?");
});

test("keeps a known streak numeric when its boundary is confirmed", () => {
  assert.equal(streakLabel(history("L", "W", "W")), "W2");
});

test("shows unknown when every completed result is hidden and a dash before the season", () => {
  assert.equal(streakLabel(history(null, null)), "?");
  assert.equal(streakLabel([]), "-");
});
