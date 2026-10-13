import assert from "node:assert/strict";
import test from "node:test";
import { formatWeekDate, gamePresentation } from "../schedule-time.mjs";

function game(date, time, weekday = "Monday") {
  return { date, time, weekday };
}

test("converts Eastern daylight-time kickoffs to the selected local zone", () => {
  const presentation = gamePresentation(game("2025-07-14", "20:15"), {
    locale: "en-US",
    timeZone: "America/Los_Angeles",
  });

  assert.deepEqual(presentation, {
    date: "2025-07-14",
    weekday: "Mon",
    time: "5:15 PM",
  });
});

test("applies standard time and advances the local weekday when needed", () => {
  const presentation = gamePresentation(game("2025-12-08", "20:15"), {
    locale: "en-US",
    timeZone: "Europe/London",
  });

  assert.deepEqual(presentation, {
    date: "2025-12-09",
    weekday: "Tue",
    time: "1:15 AM",
  });
});

test("uses converted local dates when formatting a week range across midnight", () => {
  const games = [
    game("2025-10-13", "20:30"),
    game("2025-10-19", "13:00", "Sunday"),
  ];

  assert.equal(formatWeekDate(games, {
    locale: "en-US",
    timeZone: "Pacific/Kiritimati",
  }), "October 14 - October 20");
});

test("keeps games without a known kickoff as Time TBD on their source date", () => {
  const presentation = gamePresentation(game("2025-10-13", ""), {
    locale: "en-US",
    timeZone: "Pacific/Kiritimati",
  });

  assert.deepEqual(presentation, {
    date: "2025-10-13",
    weekday: "Mon",
    time: "Time TBD",
  });
});

test("formats date labels using the selected locale", () => {
  const presentation = gamePresentation(game("2025-07-14", "20:15"), {
    locale: "de-DE",
    timeZone: "Europe/Berlin",
  });

  assert.deepEqual(presentation, {
    date: "2025-07-15",
    weekday: "Di",
    time: "2:15",
  });
});
