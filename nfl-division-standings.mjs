function recordPercentage(record) {
  const gamesPlayed = record.wins + record.losses + record.ties;
  return gamesPlayed ? (record.wins + 0.5 * record.ties) / gamesPlayed : 0;
}

function compareTeamPercentage(left, right) {
  const leftGames = left.gamesPlayed || 0;
  const rightGames = right.gamesPlayed || 0;
  const leftDenominator = leftGames || 1;
  const rightDenominator = rightGames || 1;
  const leftNumerator = 2 * left.wins + left.ties;
  const rightNumerator = 2 * right.wins + right.ties;
  return leftNumerator * rightDenominator - rightNumerator * leftDenominator;
}

function knownResults(games, revealedGameIds) {
  return games.filter((game) => game.status === "final"
    && revealedGameIds.has(game.id)
    && Number.isFinite(game.awayScore)
    && Number.isFinite(game.homeScore));
}

function gameForTeam(game, teamAbbreviation) {
  if (game.awayTeam === teamAbbreviation) {
    return {
      opponent: game.homeTeam,
      pointsFor: game.awayScore,
      pointsAgainst: game.homeScore,
    };
  }
  if (game.homeTeam === teamAbbreviation) {
    return {
      opponent: game.awayTeam,
      pointsFor: game.homeScore,
      pointsAgainst: game.awayScore,
    };
  }
  return null;
}

function recordAgainst(team, games, teamsByAbbreviation, opponentFilter = () => true) {
  const record = { wins: 0, losses: 0, ties: 0, games: [] };
  games.forEach((game) => {
    const result = gameForTeam(game, team.abbreviation);
    if (!result || !teamsByAbbreviation.has(result.opponent)
      || !opponentFilter(result.opponent)) return;
    record.games.push({ ...result, game });
    if (result.pointsFor > result.pointsAgainst) record.wins += 1;
    else if (result.pointsFor < result.pointsAgainst) record.losses += 1;
    else record.ties += 1;
  });
  return record;
}

function opponentsFor(team, games, teamsByAbbreviation) {
  return new Set(recordAgainst(team, games, teamsByAbbreviation).games
    .map(({ opponent }) => opponent));
}

function commonOpponents(group, games, teamsByAbbreviation) {
  const tiedTeams = new Set(group.map((team) => team.abbreviation));
  let common = null;
  group.forEach((team) => {
    const opponents = new Set([...opponentsFor(team, games, teamsByAbbreviation)]
      .filter((opponent) => !tiedTeams.has(opponent)));
    common = common === null
      ? opponents
      : new Set([...common].filter((opponent) => opponents.has(opponent)));
  });
  return common || new Set();
}

function divisionPercentage(team, games, teamsByAbbreviation) {
  const record = recordAgainst(team, games, teamsByAbbreviation, (opponentAbbreviation) => {
    const opponent = teamsByAbbreviation.get(opponentAbbreviation);
    return opponent.conference === team.conference && opponent.division === team.division;
  });
  return recordPercentage(record);
}

function conferencePercentage(team, games, teamsByAbbreviation) {
  const record = recordAgainst(team, games, teamsByAbbreviation, (opponentAbbreviation) => (
    teamsByAbbreviation.get(opponentAbbreviation).conference === team.conference
  ));
  return recordPercentage(record);
}

function headToHeadPercentage(team, group, games, teamsByAbbreviation) {
  const tiedTeams = new Set(group.map((other) => other.abbreviation));
  tiedTeams.delete(team.abbreviation);
  return recordPercentage(recordAgainst(
    team,
    games,
    teamsByAbbreviation,
    (opponentAbbreviation) => tiedTeams.has(opponentAbbreviation),
  ));
}

function commonGamePercentage(team, common, games, teamsByAbbreviation) {
  return recordPercentage(recordAgainst(
    team,
    games,
    teamsByAbbreviation,
    (opponentAbbreviation) => common.has(opponentAbbreviation),
  ));
}

function strengthPercentage(team, games, teamsByAbbreviation, victoriesOnly = false) {
  const aggregate = { wins: 0, losses: 0, ties: 0 };
  recordAgainst(team, games, teamsByAbbreviation).games.forEach((game) => {
    if (victoriesOnly && game.pointsFor <= game.pointsAgainst) return;
    const opponent = teamsByAbbreviation.get(game.opponent);
    aggregate.wins += opponent.wins;
    aggregate.losses += opponent.losses;
    aggregate.ties += opponent.ties;
  });
  return recordPercentage(aggregate);
}

function rankingAmong(team, allTeams, conferenceOnly, pointsField, highIsGood) {
  const pool = conferenceOnly
    ? allTeams.filter((other) => other.conference === team.conference)
    : allTeams;
  return 1 + pool.filter((other) => {
    if (other.abbreviation === team.abbreviation) return false;
    return highIsGood
      ? other[pointsField] > team[pointsField]
      : other[pointsField] < team[pointsField];
  }).length;
}

function combinedPointsRanking(team, allTeams, conferenceOnly) {
  return rankingAmong(team, allTeams, conferenceOnly, "pointsFor", true)
    + rankingAmong(team, allTeams, conferenceOnly, "pointsAgainst", false);
}

function netPoints(team, games, teamsByAbbreviation, opponents = null) {
  return recordAgainst(
    team,
    games,
    teamsByAbbreviation,
    (opponentAbbreviation) => opponents === null || opponents.has(opponentAbbreviation),
  ).games.reduce((total, game) => total + game.pointsFor - game.pointsAgainst, 0);
}

function comparisonCriteria(group, context) {
  const { games, teamsByAbbreviation, allTeams } = context;
  const common = commonOpponents(group, games, teamsByAbbreviation);
  return [
    (team) => headToHeadPercentage(team, group, games, teamsByAbbreviation),
    (team) => divisionPercentage(team, games, teamsByAbbreviation),
    (team) => commonGamePercentage(team, common, games, teamsByAbbreviation),
    (team) => conferencePercentage(team, games, teamsByAbbreviation),
    (team) => strengthPercentage(team, games, teamsByAbbreviation, true),
    (team) => strengthPercentage(team, games, teamsByAbbreviation),
    (team) => combinedPointsRanking(team, allTeams, true),
    (team) => combinedPointsRanking(team, allTeams, false),
    (team) => netPoints(team, games, teamsByAbbreviation, common),
    (team) => netPoints(team, games, teamsByAbbreviation),
    // The source has no touchdown counts; ties through net points fall back to
    // a stable name order rather than pretending to calculate net touchdowns.
  ];
}

function alphabetical(left, right) {
  return (left.nickname || left.name || left.abbreviation)
    .localeCompare(right.nickname || right.name || right.abbreviation)
    || left.abbreviation.localeCompare(right.abbreviation);
}

function bestByTiebreakers(group, context) {
  if (group.length < 2) return group[0];
  const criteria = comparisonCriteria(group, context);
  for (const criterion of criteria) {
    const values = group.map(criterion);
    const best = Math.max(...values);
    const leaders = group.filter((team, index) => Math.abs(values[index] - best) < 1e-10);
    if (leaders.length === group.length) continue;
    if (leaders.length === 1) return leaders[0];

    // Once a criterion separates clubs, restart the tiebreak sequence for the
    // remaining tied leaders, as the NFL procedure specifies.
    return bestByTiebreakers(leaders, context);
  }
  return [...group].sort(alphabetical)[0];
}

function rankTiedGroup(group, context) {
  const remaining = [...group];
  const ranked = [];
  while (remaining.length) {
    const best = bestByTiebreakers(remaining, context);
    ranked.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return ranked;
}

export function sortDivisionStandings(divisionTeams, allTeams, games, revealedGameIds) {
  const knownGames = knownResults(games, revealedGameIds);
  const teamsByAbbreviation = new Map(allTeams.map((team) => [team.abbreviation, team]));
  const context = { games: knownGames, teamsByAbbreviation, allTeams };
  const sorted = [...divisionTeams].sort((left, right) => (
    compareTeamPercentage(right, left)
  ));
  const ranked = [];

  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && compareTeamPercentage(sorted[start], sorted[end]) === 0) end += 1;
    const group = sorted.slice(start, end);
    ranked.push(...(group.length > 1 ? rankTiedGroup(group, context) : group));
    start = end;
  }

  return ranked;
}
