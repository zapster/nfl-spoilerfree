const SEASON_TIME_ZONE = "America/New_York";

export function scheduleWeekTargets(games, now = new Date()) {
  const rangesByWeek = new Map();
  games.forEach((game) => {
    if (!Number.isInteger(game.week) || !/^\d{4}-\d{2}-\d{2}$/.test(game.date || "")) return;
    const range = rangesByWeek.get(game.week) || { week: game.week, start: game.date, end: game.date };
    range.start = game.date < range.start ? game.date : range.start;
    range.end = game.date > range.end ? game.date : range.end;
    rangesByWeek.set(game.week, range);
  });

  const weeks = [...rangesByWeek.values()].sort((left, right) => left.start.localeCompare(right.start));
  if (weeks.length === 0) return { currentWeek: null, focusWeek: null };

  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: SEASON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const firstWeek = weeks[0];
  const finalWeek = weeks.at(-1);
  const currentWeek = today < firstWeek.start || today > finalWeek.end
    ? null
    : weeks.filter((week) => week.start <= today).at(-1)?.week ?? null;

  return {
    currentWeek,
    focusWeek: currentWeek ?? (today < firstWeek.start ? firstWeek.week : finalWeek.week),
  };
}
