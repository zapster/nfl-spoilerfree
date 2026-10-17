import assert from "node:assert/strict";
import test from "node:test";
import { scheduleWeekTargets } from "../schedule-week.mjs";

function game(week, date) {
  return { week, date };
}

const thursdaySchedule = [
  game(4, "2026-10-08"),
  game(4, "2026-10-12"),
  game(5, "2026-10-15"),
  game(5, "2026-10-18"),
];

test("starts the week on its first game date in Eastern time, even when locally Friday", () => {
  const now = new Date("2026-10-16T02:30:00Z");
  assert.equal(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "long",
  }).format(now), "Friday");

  assert.deepEqual(scheduleWeekTargets(thursdaySchedule, now), {
    currentWeek: 5,
    focusWeek: 5,
  });
});

test("does not start the next week before its first game date in Eastern time", () => {
  const now = new Date("2026-10-15T03:30:00Z");
  assert.equal(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "long",
  }).format(now), "Thursday");

  assert.deepEqual(scheduleWeekTargets(thursdaySchedule, now), {
    currentWeek: 4,
    focusWeek: 4,
  });
});

test("starts a week on Wednesday when Wednesday is its first game date", () => {
  const games = [
    game(1, "2025-09-03"),
    game(1, "2025-09-07"),
    game(2, "2025-09-11"),
    game(2, "2025-09-14"),
  ];

  assert.deepEqual(scheduleWeekTargets(games, new Date("2025-09-04T01:00:00Z")), {
    currentWeek: 1,
    focusWeek: 1,
  });
});
