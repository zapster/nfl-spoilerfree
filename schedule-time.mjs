const SOURCE_TIME_ZONE = "America/New_York";

function utcEpoch(year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

function partsAt(date, timeZone, includeTime = false) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" } : {}),
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function easternOffsetAt(epoch) {
  const parts = partsAt(new Date(epoch), SOURCE_TIME_ZONE, true);
  const easternWallTime = utcEpoch(
    Number(parts.year),
    Number(parts.month),
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return easternWallTime - epoch;
}

function kickoffInstant(date, time) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  const timeMatch = /^(\d{1,2}):([0-5]\d)$/.exec(time || "");
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23) return null;

  const wallTime = utcEpoch(year, month, day, hour, minute);
  if (new Date(wallTime).toISOString().slice(0, 10) !== date) return null;

  let instant = wallTime;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = wallTime - easternOffsetAt(instant);
  }
  return new Date(instant);
}

function dateKeyAt(date, timeZone) {
  const parts = partsAt(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateFromKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(utcEpoch(year, month, day, 12));
  return date.toISOString().slice(0, 10) === dateKey ? date : null;
}

function formatDateKey(dateKey, locale, options) {
  const date = dateFromKey(dateKey);
  return date
    ? date.toLocaleDateString(locale, { ...options, timeZone: "UTC" })
    : "";
}

export function gamePresentation(game, { locale, timeZone } = {}) {
  const kickoff = kickoffInstant(game.date, game.time);
  if (!kickoff) {
    return {
      date: game.date || "",
      weekday: game.weekday?.slice(0, 3) || "",
      time: "Time TBD",
    };
  }

  return {
    date: dateKeyAt(kickoff, timeZone),
    weekday: kickoff.toLocaleDateString(locale, { timeZone, weekday: "short" }),
    time: kickoff.toLocaleTimeString(locale, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function formatWeekDate(games, options) {
  const dates = [...new Set(games
    .map((game) => gamePresentation(game, options).date)
    .filter((date) => dateFromKey(date)))].sort();
  if (dates.length === 0) return "";
  if (dates.length === 1) {
    return formatDateKey(dates[0], options?.locale, { month: "short", day: "numeric" });
  }

  const firstLabel = formatDateKey(dates[0], options?.locale, { month: "long", day: "numeric" });
  const lastLabel = formatDateKey(dates.at(-1), options?.locale, { month: "long", day: "numeric" });
  return `${firstLabel} - ${lastLabel}`;
}
