export function recordsBeforeGames(games, revealed) {
  const recordsByTeam = new Map();
  const teamRecord = (abbreviation) => {
    if (!recordsByTeam.has(abbreviation)) {
      recordsByTeam.set(abbreviation, { wins: 0, losses: 0, ties: 0, hiddenGames: 0 });
    }
    return recordsByTeam.get(abbreviation);
  };
  const recordsByGame = new Map();

  games.forEach((game) => {
    recordsByGame.set(game.id, {
      [game.awayTeam]: { ...teamRecord(game.awayTeam) },
      [game.homeTeam]: { ...teamRecord(game.homeTeam) },
    });
    if (game.status !== "final") return;

    const awayResult = game.awayScore === game.homeScore
      ? "tie"
      : game.awayScore > game.homeScore ? "win" : "loss";
    const homeResult = awayResult === "tie" ? "tie" : awayResult === "win" ? "loss" : "win";
    [[game.awayTeam, awayResult], [game.homeTeam, homeResult]].forEach(([abbreviation, result]) => {
      const record = teamRecord(abbreviation);
      if (!revealed.has(game.id)) {
        record.hiddenGames += 1;
      } else {
        const resultKey = result === "win" ? "wins" : result === "loss" ? "losses" : "ties";
        record[resultKey] += 1;
      }
    });
  });

  return recordsByGame;
}
