const DATA = {
  season: 2025,
  gamesUrl: "./data/fixtures/2025-mid-week-7/games.csv",
  teamsUrl: "./data/fixtures/2025-mid-week-7/teams_colors_logos.csv",
};

const REVEAL_STORAGE_KEY = `nfl-spoiler-free:revealed:v1:${DATA.season}`;

const state = {
  games: [],
  teams: new Map(),
  revealed: new Set(),
  expandedWeeks: new Set(),
  view: window.location.hash === "#standings" ? "standings" : "schedule",
  conference: "AFC",
  currentWeek: null,
};

const loading = document.querySelector("#loading");
const error = document.querySelector("#error");
const content = document.querySelector("#content");

function parseCsv(text) {
  const records = [];
  let record = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      record.push(value);
      if (record.some((field) => field !== "")) records.push(record);
      record = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value !== "" || record.length > 0) {
    record.push(value);
    if (record.some((field) => field !== "")) records.push(record);
  }

  const [headers, ...rows] = records;
  return rows.map((row) => Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""]),
  ));
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTeams(rows) {
  return new Map(rows.map((row) => {
    const divisionParts = (row.team_division || "").split(" ");
    return [row.team_abbr, {
      abbreviation: row.team_abbr,
      name: row.team_name || row.team_abbr,
      nickname: row.team_nick || row.team_name || row.team_abbr,
      conference: row.team_conf || divisionParts[0] || "",
      division: divisionParts.slice(1).join(" ") || row.team_division || "",
      colors: [row.team_color, row.team_color2].filter(Boolean),
      logoUrl: row.team_logo_espn || row.team_logo_wikipedia || "",
    }];
  }));
}

function normalizeGames(rows) {
  return rows
    .filter((row) => Number(row.season) === DATA.season && row.game_type === "REG")
    .map((row) => {
      const awayScore = numberOrNull(row.away_score);
      const homeScore = numberOrNull(row.home_score);
      return {
        id: row.game_id,
        season: Number(row.season),
        gameType: row.game_type,
        week: Number(row.week),
        date: row.gameday,
        weekday: row.weekday,
        time: row.gametime,
        awayTeam: row.away_team,
        homeTeam: row.home_team,
        awayScore,
        homeScore,
        status: awayScore !== null && homeScore !== null ? "final" : "scheduled",
        overtime: row.overtime === "1",
      };
    })
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
}

function restoreRevealedGames() {
  try {
    const saved = localStorage.getItem(REVEAL_STORAGE_KEY);
    if (!saved) return;

    const gameIds = JSON.parse(saved);
    if (!Array.isArray(gameIds)) return;

    const completedGameIds = new Set(
      state.games.filter((game) => game.status === "final").map((game) => game.id),
    );
    state.revealed = new Set(
      gameIds.filter((gameId) => typeof gameId === "string" && completedGameIds.has(gameId)),
    );
  } catch {
    state.revealed.clear();
  }
}

function persistRevealedGames() {
  try {
    localStorage.setItem(REVEAL_STORAGE_KEY, JSON.stringify([...state.revealed]));
  } catch {
    // Revealing games remains available for this page load when storage is blocked.
  }
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatWeekDate(games) {
  const dates = [...new Set(games.map((game) => game.date))].sort();
  if (dates.length === 0) return "";
  if (dates.length === 1) return formatDate(dates[0]);
  const first = new Date(`${dates[0]}T12:00:00`);
  const last = new Date(`${dates.at(-1)}T12:00:00`);
  const firstLabel = first.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const lastLabel = last.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${firstLabel} - ${lastLabel}`;
}

function formatTime(time) {
  if (!time) return "Time TBD";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function teamFor(abbreviation) {
  return state.teams.get(abbreviation) || {
    abbreviation,
    name: abbreviation,
    nickname: abbreviation,
    colors: ["#697386"],
    logoUrl: "",
  };
}

function logoElement(team, size = "large") {
  const logo = document.createElement("span");
  logo.className = `team-logo team-logo-${size}`;
  logo.style.setProperty("--badge-color", team.colors[0] || "#697386");
  logo.innerHTML = `<span class="team-logo-fallback">${team.abbreviation}</span>`;

  if (team.logoUrl) {
    const image = document.createElement("img");
    image.src = team.logoUrl;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.addEventListener("error", () => image.remove());
    logo.append(image);
  }
  return logo;
}

function teamElement(team, home = false) {
  const element = document.createElement("div");
  element.className = `team${home ? " home" : ""}`;
  const name = document.createElement("span");
  name.textContent = team.nickname;
  if (home) {
    element.append(name, logoElement(team));
  } else {
    element.append(logoElement(team), name);
  }
  return element;
}

function gameElement(game) {
  const away = teamFor(game.awayTeam);
  const home = teamFor(game.homeTeam);
  const article = document.createElement("article");
  article.className = "game-card";

  const time = document.createElement("div");
  time.className = "game-time";
  time.innerHTML = `<strong class="${game.status === "final" ? "is-final" : "is-scheduled"}">${game.status === "final" ? "Final" : "Scheduled"}</strong>${game.weekday.slice(0, 3)}<br>${formatTime(game.time)}`;

  const matchup = document.createElement("div");
  matchup.className = "matchup";
  matchup.append(teamElement(away));

  if (game.status === "final" && !state.revealed.has(game.id)) {
    const reveal = document.createElement("button");
    reveal.className = "game-score";
    reveal.type = "button";
    reveal.textContent = "-";
    reveal.setAttribute("aria-label", `Reveal score for ${away.nickname} at ${home.nickname}`);
    reveal.addEventListener("click", () => {
      state.revealed.add(game.id);
      persistRevealedGames();
      render();
    });
    matchup.append(reveal);
  } else if (game.status === "final") {
    const score = document.createElement("button");
    score.className = "game-score is-revealed";
    score.type = "button";
    score.textContent = `${game.awayScore} - ${game.homeScore}`;
    score.setAttribute("aria-label", `Hide score for ${away.nickname} at ${home.nickname}`);
    score.addEventListener("click", () => {
      state.revealed.delete(game.id);
      persistRevealedGames();
      render();
    });
    matchup.append(score);
  } else {
    const score = document.createElement("span");
    score.className = "game-score is-scheduled";
    score.textContent = "-";
    matchup.append(score);
  }

  matchup.append(teamElement(home, true));
  article.append(time, matchup);
  return article;
}

function scheduleView() {
  const weeks = [...new Set(state.games.map((game) => game.week))].sort((left, right) => left - right);
  const section = document.createElement("section");
  section.className = "page-section";
  section.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">${DATA.season} regular season</p>
        <h1>Schedule</h1>
        <p class="intro">Week ${state.currentWeek} is current <span aria-hidden="true">•</span> Results hidden by default</p>
      </div>
      <div class="data-note">${weeks.length} weeks loaded</div>
    </div>
    <div class="week-stream" id="week-stream"></div>
  `;
  const stream = section.querySelector("#week-stream");
  weeks.forEach((weekNumber) => {
    const games = state.games.filter((game) => game.week === weekNumber);
    const uncoveredGames = games.filter((game) => state.revealed.has(game.id)).length;
    const completedGames = games.filter((game) => game.status === "final");
    const remainingResults = completedGames.filter((game) => !state.revealed.has(game.id));
    const week = document.createElement("details");
    week.className = `week-block${weekNumber === state.currentWeek ? " is-current" : ""}`;
    week.open = state.expandedWeeks.has(weekNumber);
    week.addEventListener("toggle", () => {
      if (week.open) {
        state.expandedWeeks.add(weekNumber);
      } else {
        state.expandedWeeks.delete(weekNumber);
      }
    });
    week.innerHTML = `
      <summary class="week-summary">
        <span class="week-summary-copy">
          <span class="week-title">Week ${weekNumber}${weekNumber === state.currentWeek ? ' <span class="current-week">Current</span>' : ""}</span>
          <span class="week-date">${formatWeekDate(games)}</span>
        </span>
        <span class="week-summary-actions">
          <button class="uncover-all" type="button"></button>
          <span class="week-count" aria-label="${uncoveredGames} of ${games.length} games uncovered">${uncoveredGames}/${games.length}</span>
          <span class="week-toggle" aria-hidden="true"></span>
        </span>
      </summary>
      <div class="games"></div>
    `;
    const uncoverAll = week.querySelector(".uncover-all");
    const allRevealed = completedGames.length > 0 && remainingResults.length === 0;
    uncoverAll.textContent = remainingResults.length ? "Reveal all" : completedGames.length ? "All revealed" : "No results";
    uncoverAll.disabled = completedGames.length === 0;
    uncoverAll.title = !completedGames.length
      ? "No completed scores are available in this week"
      : allRevealed
        ? "Click to hide all revealed scores in this week"
        : "Reveal all completed scores in this week";
    uncoverAll.setAttribute("aria-label", uncoverAll.title);
    uncoverAll.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (remainingResults.length) {
        completedGames.forEach((game) => state.revealed.add(game.id));
      } else {
        completedGames.forEach((game) => state.revealed.delete(game.id));
      }
      persistRevealedGames();
      render();
    });
    const list = week.querySelector(".games");
    games.forEach((game) => list.append(gameElement(game)));
    stream.append(week);
  });
  return section;
}

function calculateStandings() {
  const standings = new Map([...state.teams].map(([abbreviation, team]) => [abbreviation, {
    ...team,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    history: [],
  }]));

  state.games
    .filter((game) => game.status === "final")
    .forEach((game) => {
      const away = standings.get(game.awayTeam);
      const home = standings.get(game.homeTeam);
      if (!away || !home) return;

      const known = state.revealed.has(game.id);
      const awayResult = game.awayScore === game.homeScore
        ? "T"
        : game.awayScore > game.homeScore ? "W" : "L";
      const homeResult = game.awayScore === game.homeScore
        ? "T"
        : game.homeScore > game.awayScore ? "W" : "L";
      away.history.push({ result: known ? awayResult : null });
      home.history.push({ result: known ? homeResult : null });
      if (!known) return;

      away.gamesPlayed += 1;
      home.gamesPlayed += 1;
      away.pointsFor += game.awayScore;
      away.pointsAgainst += game.homeScore;
      home.pointsFor += game.homeScore;
      home.pointsAgainst += game.awayScore;
      if (awayResult === "T") {
        away.ties += 1;
        home.ties += 1;
      } else if (awayResult === "W") {
        away.wins += 1;
        home.losses += 1;
      } else {
        away.losses += 1;
        home.wins += 1;
      }
    });

  return standings;
}

function recordLabel(team) {
  return `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`;
}

function streakLabel(team) {
  if (team.history.length === 0) return "-";
  const latest = team.history.at(-1).result;
  if (!latest) return "?";

  let count = 1;
  let index = team.history.length - 2;
  while (index >= 0 && team.history[index].result === latest) {
    count += 1;
    index -= 1;
  }
  if (index >= 0 && team.history[index].result === null) return `${latest}?`;
  return `${latest}${count}`;
}

function teamStandingElement(team, index) {
  const row = document.createElement("tr");
  const hasUnrevealedResults = team.history.some(({ result }) => result === null);
  if (hasUnrevealedResults) row.classList.add("has-unrevealed");
  const teamCell = document.createElement("td");
  const identity = document.createElement("div");
  identity.className = "team-cell";
  identity.innerHTML = `<span class="rank">${index + 1}</span>`;
  identity.append(logoElement(team, "small"));
  const name = document.createElement("span");
  name.className = "team-name";
  name.textContent = team.nickname;
  identity.append(name);
  if (hasUnrevealedResults) {
    const marker = document.createElement("span");
    marker.className = "partial-mark";
    marker.textContent = "*";
    marker.title = "Some completed results are still hidden";
    marker.setAttribute("aria-hidden", "true");
    identity.append(marker);
  }
  teamCell.append(identity);
  row.append(teamCell);

  const values = [
    { value: recordLabel(team), className: "record" },
    { value: team.gamesPlayed ? (team.wins / team.gamesPlayed).toFixed(3).replace(/^0/, "") : "-" },
    { value: streakLabel(team), className: team.history.length ? "streak" : "" },
  ];
  values.forEach(({ value, className }) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
  });
  return row;
}

function standingsView() {
  const standings = calculateStandings();
  const section = document.createElement("section");
  section.className = "page-section";
  section.innerHTML = `
    <div class="page-heading standings-heading">
      <div>
        <p class="eyebrow">${DATA.season} regular season</p>
        <h1>Standings</h1>
        <p class="intro">Known results only <span aria-hidden="true">•</span> Reveal games to update records</p>
      </div>
      <div class="conference-tabs" role="tablist" aria-label="Conference">
        <button class="conference-tab" type="button" role="tab" data-conference="AFC" aria-selected="${state.conference === "AFC"}">AFC</button>
        <button class="conference-tab" type="button" role="tab" data-conference="NFC" aria-selected="${state.conference === "NFC"}">NFC</button>
      </div>
    </div>
    <div class="division-grid" id="division-grid"></div>
    <div class="legend"><span class="partial-legend">* Partial record: some results remain hidden</span><span>Basic winning-percentage order</span></div>
  `;

  section.querySelectorAll(".conference-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.conference = button.dataset.conference;
      render();
    });
  });

  const divisions = [...new Set([...standings.values()]
    .filter((team) => team.conference === state.conference)
    .map((team) => team.division))]
    .sort();
  const grid = section.querySelector("#division-grid");
  divisions.forEach((division) => {
    const teams = [...standings.values()]
      .filter((team) => team.conference === state.conference && team.division === division)
      .sort((left, right) => {
        const pctDifference = (right.gamesPlayed ? right.wins / right.gamesPlayed : 0) - (left.gamesPlayed ? left.wins / left.gamesPlayed : 0);
        return pctDifference || right.wins - left.wins || left.nickname.localeCompare(right.nickname);
      });
    const card = document.createElement("section");
    card.className = "division";
    card.innerHTML = `
      <div class="division-heading"><h2>${state.conference} ${division}</h2><span>W-L</span></div>
      <table class="standings-table">
        <thead><tr><th scope="col">Team</th><th scope="col">W-L</th><th scope="col">Pct</th><th scope="col">Streak</th></tr></thead>
        <tbody></tbody>
      </table>
    `;
    const body = card.querySelector("tbody");
    teams.forEach((team, index) => body.append(teamStandingElement(team, index)));
    grid.append(card);
  });
  return section;
}

function render() {
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.dataset.view === state.view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  content.replaceChildren(state.view === "schedule" ? scheduleView() : standingsView());
  content.hidden = false;
}

async function loadData() {
  const responses = await Promise.all([fetch(DATA.gamesUrl), fetch(DATA.teamsUrl)]);
  responses.forEach((response) => {
    if (!response.ok) throw new Error(`Data request failed: ${response.status} ${response.statusText}`);
  });
  const [gamesText, teamsText] = await Promise.all(responses.map((response) => response.text()));
  state.games = normalizeGames(parseCsv(gamesText));
  state.teams = normalizeTeams(parseCsv(teamsText));
  if (state.games.length === 0 || state.teams.size === 0) throw new Error("NFL data was empty");
  restoreRevealedGames();
  const completedWeeks = state.games.filter((game) => game.status === "final").map((game) => game.week);
  state.currentWeek = Math.max(...completedWeeks);
  state.expandedWeeks.add(state.currentWeek);
}

document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    window.history.replaceState(null, "", state.view === "standings" ? "#standings" : "#schedule");
    render();
  });
});

window.addEventListener("hashchange", () => {
  state.view = window.location.hash === "#standings" ? "standings" : "schedule";
  if (state.games.length) render();
});

loadData()
  .then(() => {
    loading.hidden = true;
    render();
  })
  .catch((loadError) => {
    loading.hidden = true;
    error.textContent = `Unable to load NFL data. ${loadError.message}`;
    error.hidden = false;
  });
