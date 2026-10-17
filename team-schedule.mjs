export function teamScheduleByWeek(games, abbreviation) {
  const gamesByWeek = new Map();
  games.forEach((game) => {
    if (!Number.isInteger(game.week)) return;
    const weekGames = gamesByWeek.get(game.week) || [];
    weekGames.push(game);
    gamesByWeek.set(game.week, weekGames);
  });

  return [...gamesByWeek.entries()]
    .sort(([leftWeek], [rightWeek]) => leftWeek - rightWeek)
    .map(([week, weekGames]) => ({
      week,
      games: weekGames.filter((game) => game.awayTeam === abbreviation || game.homeTeam === abbreviation),
    }));
}
