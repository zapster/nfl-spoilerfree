import { formatWeekDate, gamePresentation } from "./schedule-time.mjs";
import { recordsBeforeGames } from "./schedule-records.mjs";
import { scheduleWeekTargets } from "./schedule-week.mjs";
import { streakLabel } from "./standings-streak.mjs";
import { teamScheduleByWeek } from "./team-schedule.mjs";
import { sortDivisionStandings } from "./nfl-division-standings.mjs";

const DATA = {
  season: 2025,
  manifestUrl: "https://zapster.github.io/nfl-spoilerfree-data/manifest.json",
};

const APP_STORAGE_PREFIX = "nfl-spoiler-free:";
const STORAGE_NOTICE_ACCEPTED_KEY = `${APP_STORAGE_PREFIX}storage-notice-accepted:v1`;
const SELECTED_SEASON_STORAGE_KEY = `${APP_STORAGE_PREFIX}selected-season:v1`;
const REVEAL_STORAGE_PREFIX = `${APP_STORAGE_PREFIX}revealed:v1:`;
const DATA_BACKUP_FORMAT = "nfl-spoiler-free-data";
const DATA_BACKUP_VERSION = 1;
const DATA_CACHE_DATABASE = "nfl-spoiler-free-data";
const DATA_CACHE_STORE = "season-snapshots";
const DATA_REVALIDATE_INTERVAL = 60 * 60 * 1000;

let dataCacheDatabase;
let dataCacheGeneration = 0;

const state = {
  games: [],
  teams: new Map(),
  revealed: new Set(),
  expandedWeeks: new Set(),
  view: window.location.hash === "#standings" ? "standings" : "schedule",
  conference: "AFC",
  currentWeek: null,
  focusWeek: null,
};

const loading = document.querySelector("#loading");
const error = document.querySelector("#error");
const content = document.querySelector("#content");
const storageNotice = document.querySelector("#storage-notice");
const seasonSelect = document.querySelector("#season-select");
const dataDialog = document.querySelector("#data-dialog");
const dataStatus = document.querySelector("#data-status");
const teamDialog = document.querySelector("#team-dialog");
const teamDialogLogo = document.querySelector("#team-dialog-logo");
const teamDialogTitle = document.querySelector("#team-dialog-title");
const teamDialogStandings = document.querySelector("#team-dialog-standings");
const teamDialogSeason = document.querySelector("#team-dialog-season");
const teamGamesList = document.querySelector("#team-games-list");

let returnTeamAbbreviation = null;
let returnTeamGameId = null;
let teamDialogReturnScroll = 0;
let publishedManifest = null;

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

function safeLogoUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:"
      || url.username || url.password || url.port
      || !["a.espncdn.com", "upload.wikimedia.org"].includes(url.hostname)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizeTeams(rows, seasonTeams) {
  return new Map(rows
    .filter((row) => seasonTeams.has(row.team_abbr))
    .map((row) => {
      const divisionParts = (row.team_division || "").split(" ");
      return [row.team_abbr, {
        abbreviation: row.team_abbr,
        name: row.team_name || row.team_abbr,
        nickname: row.team_nick || row.team_name || row.team_abbr,
        conference: row.team_conf || divisionParts[0] || "",
        division: divisionParts.slice(1).join(" ") || row.team_division || "",
        colors: [row.team_color, row.team_color2].filter((color) => /^#[\da-f]{6}$/i.test(color)),
        logoUrl: safeLogoUrl(row.team_logo_espn) || safeLogoUrl(row.team_logo_wikipedia),
      }];
    }));
}

function normalizeGames(rows, season = DATA.season) {
  return rows
    .filter((row) => Number(row.season) === season && row.game_type === "REG")
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

function completedGameIds() {
  return new Set(state.games.filter((game) => game.status === "final").map((game) => game.id));
}

function revealStorageKey(season = DATA.season) {
  return `${REVEAL_STORAGE_PREFIX}${season}`;
}

function restoreRevealedGames() {
  const completedIds = completedGameIds();
  try {
    const saved = localStorage.getItem(revealStorageKey());
    const gameIds = saved ? JSON.parse(saved) : [];
    state.revealed = new Set(
      [...state.revealed, ...(Array.isArray(gameIds) ? gameIds : [])]
        .filter((gameId) => typeof gameId === "string" && completedIds.has(gameId)),
    );
  } catch {
    state.revealed = new Set([...state.revealed].filter((gameId) => completedIds.has(gameId)));
  }
}

function persistRevealedGames() {
  try {
    localStorage.setItem(revealStorageKey(), JSON.stringify([...state.revealed]));
  } catch {
    // Revealing games remains available for this page load when storage is blocked.
  }
}

function readSavedRevealSets() {
  const seasons = new Map();
  let available = true;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(REVEAL_STORAGE_PREFIX)) continue;

      const season = key.slice(REVEAL_STORAGE_PREFIX.length);
      if (!/^\d{4}$/.test(season)) continue;
      let saved;
      try {
        saved = localStorage.getItem(key);
      } catch {
        available = false;
        continue;
      }
      try {
        const gameIds = JSON.parse(saved);
        if (Array.isArray(gameIds)) {
          seasons.set(season, new Set(gameIds.filter((gameId) => typeof gameId === "string" && gameId)));
        }
      } catch {
        // Ignore malformed entries and keep reading other seasons.
      }
    }
    return { seasons, available };
  } catch {
    return { seasons, available: false };
  }
}

function validateDataBackup(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)
    || backup.format !== DATA_BACKUP_FORMAT || backup.version !== DATA_BACKUP_VERSION
    || typeof backup.exportedAt !== "string" || Number.isNaN(Date.parse(backup.exportedAt))
    || !backup.revealedGames || typeof backup.revealedGames !== "object"
    || Array.isArray(backup.revealedGames)) {
    throw new Error("This is not a supported NFL Spoiler-Free JSON backup.");
  }

  const seasons = new Map();
  Object.entries(backup.revealedGames).forEach(([season, gameIds]) => {
    if (!/^\d{4}$/.test(season) || !Array.isArray(gameIds)
      || gameIds.some((gameId) => typeof gameId !== "string" || !gameId)) {
      throw new Error("The backup contains an invalid season or game ID list.");
    }
    seasons.set(season, new Set(gameIds));
  });
  return seasons;
}

function saveRevealSets(seasons) {
  let saved = true;
  seasons.forEach((gameIds, season) => {
    try {
      localStorage.setItem(`${REVEAL_STORAGE_PREFIX}${season}`, JSON.stringify([...gameIds]));
    } catch {
      saved = false;
    }
  });
  return saved;
}

function setDataStatus(message, isError = false) {
  dataStatus.textContent = message;
  dataStatus.classList.toggle("is-error", isError);
}

function createDataBackup() {
  const { seasons, available } = readSavedRevealSets();
  const currentSeason = String(DATA.season);
  const currentReveals = seasons.get(currentSeason) || new Set();
  state.revealed.forEach((gameId) => currentReveals.add(gameId));
  seasons.set(currentSeason, currentReveals);

  return {
    available,
    backup: {
      format: DATA_BACKUP_FORMAT,
      version: DATA_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      revealedGames: Object.fromEntries([...seasons.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([season, gameIds]) => [season, [...gameIds].sort()])),
    },
  };
}

function mergeDataBackup(importedSeasons) {
  const { seasons, available } = readSavedRevealSets();
  const currentSeason = String(DATA.season);
  const currentReveals = seasons.get(currentSeason) || new Set();
  state.revealed.forEach((gameId) => currentReveals.add(gameId));
  seasons.set(currentSeason, currentReveals);

  importedSeasons.forEach((gameIds, season) => {
    const merged = seasons.get(season) || new Set();
    gameIds.forEach((gameId) => merged.add(gameId));
    seasons.set(season, merged);
  });

  if (state.games.length) {
    const completedIds = completedGameIds();
    seasons.set(currentSeason, new Set(
      [...(seasons.get(currentSeason) || [])].filter((gameId) => completedIds.has(gameId)),
    ));
  }
  state.revealed = new Set(seasons.get(currentSeason) || []);
  const saved = available && saveRevealSets(seasons);
  if (state.games.length) render();
  return { saved, available };
}

function resetSavedData() {
  let cleared = true;
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(REVEAL_STORAGE_PREFIX) || key === SELECTED_SEASON_STORAGE_KEY) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    cleared = false;
  }
  state.revealed.clear();
  if (state.games.length) render();
  return cleared;
}

document.querySelector("#manage-data").addEventListener("click", () => {
  setDataStatus("");
  dataDialog.showModal();
});

document.querySelector("#close-data-dialog").addEventListener("click", () => dataDialog.close());

dataDialog.addEventListener("click", (event) => {
  if (event.target === dataDialog) dataDialog.close();
});

document.querySelector("#export-data").addEventListener("click", () => {
  try {
    const { backup, available } = createDataBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nfl-spoiler-free-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDataStatus(available
      ? "JSON backup downloaded."
      : "Downloaded the current selection; browser storage was unavailable for other seasons.", !available);
  } catch {
    setDataStatus("The JSON backup could not be created.", true);
  }
});

document.querySelector("#import-data").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    const importedSeasons = validateDataBackup(backup);
    const { saved, available } = mergeDataBackup(importedSeasons);
    setDataStatus(saved
      ? "Selections merged from the JSON backup."
      : available
        ? "Selections merged for this page, but browser storage could not save all seasons."
        : "Selections merged for this page, but browser storage could not be read or updated.", !saved);
  } catch (importError) {
    setDataStatus(importError instanceof SyntaxError
      ? "The selected file is not valid JSON."
      : importError.message || "The JSON backup could not be imported.", true);
  } finally {
    input.value = "";
  }
});

document.querySelector("#clear-cache").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await clearDataCache();
    setDataStatus("The cached manifest and season data were cleared. The current view remains loaded.");
  } catch {
    setDataStatus("The cached manifest and season data could not be cleared.", true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#reset-data").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset saved reveal selections and the saved season choice in this browser? This cannot be undone.",
  );
  if (!confirmed) return;

  const cleared = resetSavedData();
  setDataStatus(cleared
    ? "Saved reveal selections and season choice were cleared."
    : "The current selections were cleared, but browser storage could not be fully cleared.", !cleared);
});

document.querySelector("#close-team-dialog").addEventListener("click", () => teamDialog.close());

teamDialogStandings.addEventListener("click", () => {
  const abbreviation = teamDialogStandings.dataset.teamAbbr;
  if (!abbreviation) return;

  const team = teamFor(abbreviation);
  if (!team.conference || !team.division) return;

  returnTeamAbbreviation = null;
  returnTeamGameId = null;
  state.view = "standings";
  state.conference = team.conference;
  window.history.replaceState(null, "", "#standings");
  teamDialog.close();
  render();

  window.requestAnimationFrame(() => {
    const target = [...content.querySelectorAll("[data-standing-team-abbr]")]
      .find((row) => row.dataset.standingTeamAbbr === abbreviation);
    if (!target) return;

    target.classList.add("is-target");
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    target.scrollIntoView({ behavior, block: "center" });
    target.focus({ preventScroll: true });
    window.setTimeout(() => target.classList.remove("is-target"), 2400);
  });
});

teamDialog.addEventListener("click", (event) => {
  if (event.target === teamDialog) teamDialog.close();
});

teamDialog.addEventListener("close", () => {
  const abbreviation = returnTeamAbbreviation;
  const gameId = returnTeamGameId;
  returnTeamAbbreviation = null;
  returnTeamGameId = null;
  if (!abbreviation) return;

  render();
  window.scrollTo(0, teamDialogReturnScroll);
  window.requestAnimationFrame(() => {
    const teamButtons = [...content.querySelectorAll("[data-team-abbr]")];
    const returnButton = teamButtons.find((button) => button.dataset.teamAbbr === abbreviation
      && (!gameId || button.dataset.gameId === gameId))
      || teamButtons.find((button) => button.dataset.teamAbbr === abbreviation);
    returnButton?.focus({ preventScroll: true });
  });
});

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
  const fallback = document.createElement("span");
  fallback.className = "team-logo-fallback";
  fallback.textContent = team.abbreviation;
  logo.append(fallback);

  if (team.logoUrl) {
    const image = document.createElement("img");
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.addEventListener("load", () => fallback.remove(), { once: true });
    image.addEventListener("error", () => image.remove());
    image.src = team.logoUrl;
    logo.append(image);
  }
  return logo;
}

function teamElement(team, record, home = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `team${home ? " home" : ""}`;
  element.dataset.teamAbbr = team.abbreviation;
  const recordText = recordLabel(record);
  const hiddenResultsText = record.hiddenGames === 1
    ? "1 earlier result is hidden"
    : `${record.hiddenGames} earlier results are hidden`;
  element.setAttribute("aria-label", record.hiddenGames
    ? `View ${team.name} regular-season games. Record before this game: ${recordText}; partial, ${hiddenResultsText}.`
    : `View ${team.name} regular-season games. Record before this game: ${recordText}.`);
  element.setAttribute("aria-haspopup", "dialog");
  element.setAttribute("aria-controls", "team-dialog");
  element.addEventListener("click", (event) => openTeamGames(team.abbreviation, event.currentTarget));
  const name = document.createElement("span");
  name.className = "team-name";
  name.textContent = team.nickname;
  const recordElement = document.createElement("span");
  recordElement.className = `team-record${record.hiddenGames ? " is-partial" : ""}`;
  recordElement.textContent = `${recordText}${record.hiddenGames ? "*" : ""}`;
  recordElement.title = record.hiddenGames
    ? `${recordText} from revealed games; ${hiddenResultsText}`
    : `Record before this game: ${recordText}`;
  recordElement.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.className = "team-copy";
  copy.append(name, recordElement);
  if (home) {
    element.append(copy, logoElement(team));
  } else {
    element.append(logoElement(team), copy);
  }
  return element;
}

function weekDateElement(weekNumber, games) {
  const weekDate = document.createElement("span");
  weekDate.className = "game-week-date";
  const date = formatWeekDate(games);
  weekDate.append(document.createTextNode(`Week ${weekNumber}${date ? ` · ${date}` : ""}`));
  if (weekNumber === state.currentWeek) {
    const currentMarker = document.createElement("span");
    currentMarker.className = "current-week";
    currentMarker.textContent = "Current";
    weekDate.append(currentMarker);
  }
  return weekDate;
}

function byeWeekElement(weekNumber) {
  const article = document.createElement("article");
  article.className = "team-bye-week";
  article.dataset.week = String(weekNumber);

  const weekDate = document.createElement("div");
  weekDate.className = "team-bye-week-label";
  weekDate.append(weekDateElement(weekNumber, []));

  const label = document.createElement("strong");
  label.className = "team-bye-week-status";
  label.textContent = "Bye Week";
  article.append(weekDate, label);
  return article;
}

function gameElement(
  game,
  onScoreChange = () => render(),
  { showWeekDate = false, recordsByGame } = {},
) {
  const away = teamFor(game.awayTeam);
  const home = teamFor(game.homeTeam);
  const gameRecords = recordsByGame.get(game.id);
  const presentation = gamePresentation(game);
  const article = document.createElement("article");
  article.className = "game-card";

  const time = document.createElement("div");
  time.className = "game-time";
  const status = document.createElement("strong");
  status.className = game.status === "final" ? "is-final" : "is-scheduled";
  status.textContent = game.status === "final" ? "Final" : "Scheduled";
  time.append(status);
  if (showWeekDate) {
    time.append(weekDateElement(game.week, [game]));
  } else {
    time.append(
      document.createTextNode(presentation.weekday),
      document.createElement("br"),
      document.createTextNode(presentation.time),
    );
  }

  const matchup = document.createElement("div");
  matchup.className = "matchup";
  const awayElement = teamElement(away, gameRecords[game.awayTeam]);
  awayElement.dataset.gameId = game.id;
  matchup.append(awayElement);

  if (game.status === "final" && !state.revealed.has(game.id)) {
    const reveal = document.createElement("button");
    reveal.className = "game-score";
    reveal.type = "button";
    reveal.dataset.gameId = game.id;
    reveal.textContent = "-";
    reveal.setAttribute("aria-label", `Reveal score for ${away.nickname} at ${home.nickname}`);
    reveal.addEventListener("click", () => {
      state.revealed.add(game.id);
      persistRevealedGames();
      onScoreChange(game.id);
    });
    matchup.append(reveal);
  } else if (game.status === "final") {
    const score = document.createElement("button");
    score.className = "game-score is-revealed";
    score.type = "button";
    score.dataset.gameId = game.id;
    score.textContent = `${game.awayScore} - ${game.homeScore}`;
    score.setAttribute("aria-label", `Hide score for ${away.nickname} at ${home.nickname}`);
    score.addEventListener("click", () => {
      state.revealed.delete(game.id);
      persistRevealedGames();
      onScoreChange(game.id);
    });
    matchup.append(score);
  } else {
    const score = document.createElement("span");
    score.className = "game-score is-scheduled";
    score.textContent = "-";
    matchup.append(score);
  }

  const homeElement = teamElement(home, gameRecords[game.homeTeam], true);
  homeElement.dataset.gameId = game.id;
  matchup.append(homeElement);
  article.append(time, matchup);
  return article;
}

function openTeamGames(abbreviation, trigger) {
  const alreadyOpen = teamDialog.open;
  if (!alreadyOpen) {
    returnTeamAbbreviation = abbreviation;
    returnTeamGameId = trigger?.dataset.gameId || null;
    teamDialogReturnScroll = window.scrollY;
  }
  teamGamesList.scrollTop = 0;
  renderTeamGames(abbreviation);
  if (alreadyOpen) {
    [...teamGamesList.querySelectorAll("[data-team-abbr]")]
      .find((button) => button.dataset.teamAbbr === abbreviation)
      ?.focus({ preventScroll: true });
  } else {
    teamDialog.showModal();
  }
  window.requestAnimationFrame(scrollTeamGamesToCurrent);
}

function scrollTeamGamesToCurrent() {
  const weeks = [...teamGamesList.querySelectorAll(".team-games-panel [data-week]")];
  const targetWeek = state.currentWeek ?? state.focusWeek;
  const target = targetWeek === null
    ? weeks[0]
    : weeks.find((week) => Number(week.dataset.week) === targetWeek)
      || weeks.filter((week) => Number(week.dataset.week) <= targetWeek).at(-1)
      || weeks[0];
  if (!target) return;

  teamGamesList.scrollTop += target.getBoundingClientRect().top - teamGamesList.getBoundingClientRect().top;
}

function renderTeamGames(abbreviation, focusGameId = null) {
  const team = teamFor(abbreviation);
  teamDialogStandings.dataset.teamAbbr = team.conference && team.division ? abbreviation : "";
  teamDialogStandings.textContent = `${team.conference} ${team.division}`;
  teamDialogStandings.setAttribute("aria-label", `View ${team.conference} ${team.division} standings`);
  teamDialogStandings.hidden = !team.conference || !team.division;
  const games = state.games.filter((game) => game.gameType === "REG"
    && (game.awayTeam === abbreviation || game.homeTeam === abbreviation));
  const scrollTop = teamGamesList.scrollTop;
  teamDialogLogo.replaceChildren(logoElement(team));
  teamDialogTitle.textContent = `${team.name} Games`;
  teamDialogSeason.textContent = `${DATA.season} regular season`;
  teamGamesList.replaceChildren();

  if (games.length === 0) {
    const empty = document.createElement("p");
    empty.className = "team-games-empty";
    empty.textContent = "No regular-season games are available for this team.";
    teamGamesList.append(empty);
    return;
  }

  const recordsByGame = recordsBeforeGames(state.games, state.revealed);
  const panel = document.createElement("div");
  panel.className = "team-games-panel";
  teamScheduleByWeek(state.games, abbreviation).forEach(({ week, games: weekGames }) => {
    if (weekGames.length === 0) {
      panel.append(byeWeekElement(week));
      return;
    }
    weekGames.forEach((game) => {
      const row = gameElement(
        game,
        (gameId) => renderTeamGames(abbreviation, gameId),
        { showWeekDate: true, recordsByGame },
      );
      row.dataset.week = String(week);
      panel.append(row);
    });
  });
  teamGamesList.append(panel);

  teamGamesList.scrollTop = scrollTop;
  if (focusGameId) {
    [...teamGamesList.querySelectorAll(".game-score[data-game-id]")]
      .find((button) => button.dataset.gameId === focusGameId)
      ?.focus({ preventScroll: true });
  }
}

function scheduleView() {
  const weeks = [...new Set(state.games.map((game) => game.week))].sort((left, right) => left - right);
  const recordsByGame = recordsBeforeGames(state.games, state.revealed);
  const completedGames = state.games.filter((game) => game.status === "final");
  const unrevealedGames = completedGames.filter((game) => !state.revealed.has(game.id));
  const allRevealed = completedGames.length > 0 && unrevealedGames.length === 0;
  const currentWeekNote = state.currentWeek === null
    ? "Results hidden by default"
    : `Week ${state.currentWeek} is current <span aria-hidden="true">•</span> Results hidden by default`;
  const section = document.createElement("section");
  section.className = "page-section";
  section.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">${DATA.season} regular season</p>
        <h1>Schedule</h1>
        <p class="intro">${currentWeekNote}</p>
        <p class="record-note">Records show revealed results before each game; * marks hidden earlier results.</p>
      </div>
      <div class="schedule-tools">
        <button class="uncover-all season-uncover-all" type="button"></button>
        <div class="data-note">${weeks.length} weeks loaded</div>
      </div>
    </div>
    <div class="week-stream" id="week-stream"></div>
  `;
  const seasonUncoverAll = section.querySelector(".season-uncover-all");
  seasonUncoverAll.classList.toggle("is-all-revealed", allRevealed);
  seasonUncoverAll.textContent = unrevealedGames.length
    ? "Reveal all"
    : completedGames.length ? "All revealed" : "No results";
  seasonUncoverAll.disabled = completedGames.length === 0;
  seasonUncoverAll.title = completedGames.length === 0
    ? "No completed scores are available in this season"
    : allRevealed
      ? "Click to hide all revealed scores in this season"
      : "Reveal all completed scores in this season";
  seasonUncoverAll.setAttribute("aria-label", seasonUncoverAll.title);
  seasonUncoverAll.addEventListener("click", () => {
    if (unrevealedGames.length) {
      completedGames.forEach((game) => state.revealed.add(game.id));
    } else {
      completedGames.forEach((game) => state.revealed.delete(game.id));
    }
    persistRevealedGames();
    render();
  });

  const stream = section.querySelector("#week-stream");
  weeks.forEach((weekNumber) => {
    const games = state.games.filter((game) => game.week === weekNumber);
    const uncoveredGames = games.filter((game) => state.revealed.has(game.id)).length;
    const completedGames = games.filter((game) => game.status === "final");
    const remainingResults = completedGames.filter((game) => !state.revealed.has(game.id));
    const week = document.createElement("details");
    week.className = `week-block${weekNumber === state.currentWeek ? " is-current" : ""}`;
    week.dataset.week = String(weekNumber);
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
    uncoverAll.classList.toggle("is-all-revealed", allRevealed);
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
    games.forEach((game) => list.append(gameElement(game, undefined, { recordsByGame })));
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

function winningPercentage(team) {
  return team.gamesPlayed ? (team.wins + 0.5 * team.ties) / team.gamesPlayed : 0;
}

function teamStandingElement(team, index) {
  const row = document.createElement("tr");
  row.dataset.standingTeamAbbr = team.abbreviation;
  row.tabIndex = -1;
  const hasUnrevealedResults = team.history.some(({ result }) => result === null);
  if (hasUnrevealedResults) row.classList.add("has-unrevealed");
  const teamCell = document.createElement("td");
  const identity = document.createElement("div");
  identity.className = "team-cell";
  const rank = document.createElement("span");
  rank.className = "rank";
  rank.textContent = String(index + 1);
  const teamButton = document.createElement("button");
  teamButton.className = "team-identity-button";
  teamButton.type = "button";
  teamButton.dataset.teamAbbr = team.abbreviation;
  teamButton.setAttribute("aria-label", `View ${team.name} regular-season games`);
  teamButton.setAttribute("aria-haspopup", "dialog");
  teamButton.setAttribute("aria-controls", "team-dialog");
  teamButton.addEventListener("click", (event) => openTeamGames(team.abbreviation, event.currentTarget));
  teamButton.append(logoElement(team, "small"));
  const name = document.createElement("span");
  name.className = "team-name";
  name.textContent = team.nickname;
  teamButton.append(name);
  identity.append(rank, teamButton);
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
    { value: team.gamesPlayed ? winningPercentage(team).toFixed(3).replace(/^0/, "") : "-" },
    { value: streakLabel(team.history), className: team.history.length ? "streak" : "" },
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
    <div class="legend"><span class="partial-legend">* Partial record: some results remain hidden</span><span>? Streak has hidden results before or after the known run</span><span>NFL division tiebreakers use revealed results only</span></div>
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
    const allTeams = [...standings.values()];
    const teams = allTeams
      .filter((team) => team.conference === state.conference && team.division === division);
    const rankedTeams = sortDivisionStandings(teams, allTeams, state.games, state.revealed);
    const card = document.createElement("section");
    card.className = "division";
    card.innerHTML = `
      <div class="division-heading"><h2></h2></div>
      <table class="standings-table">
        <thead><tr><th scope="col">Team</th><th scope="col">W-L</th><th scope="col">Pct</th><th scope="col" aria-label="Streak"><span class="streak-label-full">Streak</span><span class="streak-label-compact" aria-hidden="true">STRK</span></th></tr></thead>
        <tbody></tbody>
      </table>
    `;
    card.querySelector(".division-heading h2").textContent = `${state.conference} ${division}`;
    const body = card.querySelector("tbody");
    rankedTeams.forEach((team, index) => body.append(teamStandingElement(team, index)));
    grid.append(card);
  });
  return section;
}

function render({ scrollToCurrentWeek = false } = {}) {
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.dataset.view === state.view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  content.replaceChildren(state.view === "schedule" ? scheduleView() : standingsView());
  content.hidden = false;
  if (scrollToCurrentWeek && state.view === "schedule") {
    window.requestAnimationFrame(() => {
      [...content.querySelectorAll(".week-block")]
        .find((week) => Number(week.dataset.week) === state.focusWeek)
        ?.scrollIntoView({ block: "start" });
    });
  }
}

function availableSeasons(manifest) {
  return Object.entries(manifest?.seasons || {})
    .filter(([season, resource]) => {
      const regularSeasonGames = Number(resource?.gameTypeCounts?.REG);
      if (!/^\d{4}$/.test(season) || !Number.isInteger(resource?.records)
        || resource.records < 1 || !Number.isFinite(regularSeasonGames)
        || regularSeasonGames < 1) return false;
      try {
        validatePublishedResource(resource);
        return true;
      } catch {
        return false;
      }
    })
    .map(([season]) => Number(season))
    .sort((left, right) => right - left);
}

function readSelectedSeason() {
  try {
    const season = localStorage.getItem(SELECTED_SEASON_STORAGE_KEY);
    return /^\d{4}$/.test(season || "") ? Number(season) : null;
  } catch {
    return null;
  }
}

function saveSelectedSeason(season) {
  try {
    localStorage.setItem(SELECTED_SEASON_STORAGE_KEY, String(season));
  } catch {
    // The newest available season remains the default when storage is blocked.
  }
}

function clearSelectedSeason() {
  try {
    localStorage.removeItem(SELECTED_SEASON_STORAGE_KEY);
  } catch {
    return false;
  }
  return true;
}

async function loadData() {
  const cacheGeneration = dataCacheGeneration;
  publishedManifest = await loadManifest(cacheGeneration);
  const seasons = availableSeasons(publishedManifest);
  if (seasons.length === 0) throw new Error("No regular-season data is available");

  seasonSelect.replaceChildren(...seasons.map((season) => {
    const option = document.createElement("option");
    option.value = String(season);
    option.textContent = String(season);
    return option;
  }));

  const savedSeason = readSelectedSeason();
  DATA.season = seasons.includes(savedSeason) ? savedSeason : seasons[0];
  if (savedSeason !== null && !seasons.includes(savedSeason)) clearSelectedSeason();
  seasonSelect.value = String(DATA.season);
  await loadSeasonData(DATA.season, publishedManifest, cacheGeneration);
  seasonSelect.disabled = false;
}

async function loadManifest(cacheGeneration = dataCacheGeneration) {
  let cachedRecord = null;
  try {
    cachedRecord = await readCacheRecord("manifest");
  } catch {
    // IndexedDB is an optional cache; data can still load from the network.
  }
  if (cacheGeneration !== dataCacheGeneration) cachedRecord = null;

  const cachedManifest = cachedRecord?.manifest;
  const cacheAge = Date.now() - cachedRecord?.checkedAt;
  const cacheIsFresh = Number.isFinite(cacheAge)
    && cacheAge >= 0 && cacheAge < DATA_REVALIDATE_INTERVAL;
  if (cacheIsFresh && availableSeasons(cachedManifest).length) return cachedManifest;

  try {
    const response = await fetch(DATA.manifestUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Data manifest request failed: ${response.status} ${response.statusText}`);
    }
    const manifest = await response.json();
    if (availableSeasons(manifest).length === 0) {
      throw new Error("The data manifest contains no available regular seasons");
    }
    try {
      await writeCacheRecord({
        season: "manifest",
        manifest,
        checkedAt: Date.now(),
      }, cacheGeneration);
    } catch {
      // A cache write failure does not prevent using the downloaded manifest.
    }
    return manifest;
  } catch (manifestError) {
    if (availableSeasons(cachedManifest).length) return cachedManifest;

    // Older app versions stored the manifest alongside their 2025 snapshot.
    const legacySeason = readSelectedSeason() || 2025;
    let legacySnapshot = null;
    try {
      legacySnapshot = await readCachedSeason(legacySeason);
    } catch {
      // The network error below is more useful when no cache can be read.
    }
    if (availableSeasons(legacySnapshot?.manifest).length) {
      try {
        await writeCacheRecord({
          season: "manifest",
          manifest: legacySnapshot.manifest,
          checkedAt: legacySnapshot.checkedAt,
        }, cacheGeneration);
      } catch {
        // The legacy manifest can still be used for this page load.
      }
      return legacySnapshot.manifest;
    }
    throw manifestError;
  }
}

async function loadSeasonData(season, manifest, cacheGeneration = dataCacheGeneration) {
  let cachedSnapshot = null;
  try {
    cachedSnapshot = await readCachedSeason(season);
  } catch {
    // IndexedDB is an optional cache; data can still load from the network.
  }
  if (cacheGeneration !== dataCacheGeneration) cachedSnapshot = null;

  if (cachedSnapshot) {
    try {
      applySeasonSnapshot(cachedSnapshot, season);
    } catch {
      cachedSnapshot = null;
    }
  }

  const gameResource = manifest.seasons[String(season)];
  const teamsResource = manifest.teams;
  const cachedDataIsCurrent = cachedSnapshot
    && cachedResourceHash(cachedSnapshot, "games", season) === gameResource.sha256
    && cachedResourceHash(cachedSnapshot, "teams", season) === teamsResource.sha256;
  if (cachedDataIsCurrent) return;

  if (cachedSnapshot) {
    refreshSeasonSnapshot(season, manifest, cachedSnapshot, cacheGeneration)
      .then((snapshot) => {
        if (DATA.season !== season) return;
        applySeasonSnapshot(snapshot, season);
        render();
      })
      .catch(() => {
        // Keep the last usable snapshot when refresh fails or the browser is offline.
      });
    return;
  }

  const snapshot = await refreshSeasonSnapshot(season, manifest, cachedSnapshot, cacheGeneration);
  if (DATA.season === season) applySeasonSnapshot(snapshot, season);
}

function openDataCache() {
  if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is unavailable"));
  if (!dataCacheDatabase) {
    dataCacheDatabase = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATA_CACHE_DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DATA_CACHE_STORE)) {
          request.result.createObjectStore(DATA_CACHE_STORE, { keyPath: "season" });
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("The data cache is blocked by another tab"));
    });
  }
  return dataCacheDatabase;
}

async function readCacheRecord(key) {
  const database = await openDataCache();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATA_CACHE_STORE, "readonly");
    const request = transaction.objectStore(DATA_CACHE_STORE).get(String(key));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function writeCacheRecord(record, cacheGeneration = dataCacheGeneration) {
  const database = await openDataCache();
  if (cacheGeneration !== dataCacheGeneration) return false;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATA_CACHE_STORE, "readwrite");
    transaction.objectStore(DATA_CACHE_STORE).put({ ...record, season: String(record.season) });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readCachedSeason(season) {
  return readCacheRecord(season);
}

async function clearDataCache() {
  dataCacheGeneration += 1;
  const database = await openDataCache();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATA_CACHE_STORE, "readwrite");
    transaction.objectStore(DATA_CACHE_STORE).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function cachedResourceHash(snapshot, resourceType, season) {
  if (resourceType === "games") {
    return snapshot.gamesSha256 || snapshot.manifest?.seasons?.[String(season)]?.sha256;
  }
  return snapshot.teamsSha256 || snapshot.manifest?.teams?.sha256;
}

function publishedResourceUrl(path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("..")) {
    throw new Error("The data manifest contains an invalid file path.");
  }
  const baseUrl = new URL(".", DATA.manifestUrl);
  const resourceUrl = new URL(path, baseUrl);
  if (resourceUrl.origin !== baseUrl.origin || !resourceUrl.pathname.startsWith(baseUrl.pathname)) {
    throw new Error("The data manifest points outside the published data repository.");
  }
  return resourceUrl.href;
}

function validatePublishedResource(resource) {
  if (!resource || typeof resource.sha256 !== "string"
    || !/^[a-f\d]{64}$/i.test(resource.sha256)) {
    throw new Error("The data manifest is missing a valid file digest.");
  }
  return publishedResourceUrl(resource.path);
}

async function fetchCsvResource(resource) {
  const response = await fetch(validatePublishedResource(resource), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Data request failed: ${response.status} ${response.statusText}`);
  }
  const csv = await response.text();
  if (!csv.trim()) throw new Error("NFL data was empty");
  return csv;
}

async function refreshSeasonSnapshot(
  season,
  manifest,
  cachedSnapshot,
  cacheGeneration = dataCacheGeneration,
) {
  const gameResource = manifest.seasons?.[String(season)];
  const teamsResource = manifest.teams;
  validatePublishedResource(gameResource);
  validatePublishedResource(teamsResource);

  const gamesUnchanged = cachedResourceHash(cachedSnapshot || {}, "games", season) === gameResource.sha256
    && typeof cachedSnapshot?.gamesCsv === "string";
  const teamsUnchanged = cachedResourceHash(cachedSnapshot || {}, "teams", season) === teamsResource.sha256
    && typeof cachedSnapshot?.teamsCsv === "string";
  const [gamesCsv, teamsCsv] = await Promise.all([
    gamesUnchanged ? cachedSnapshot.gamesCsv : fetchCsvResource(gameResource),
    teamsUnchanged ? cachedSnapshot.teamsCsv : fetchCsvResource(teamsResource),
  ]);
  const snapshot = {
    season: String(season),
    gamesSha256: gameResource.sha256,
    teamsSha256: teamsResource.sha256,
    gamesCsv,
    teamsCsv,
    checkedAt: Date.now(),
  };
  normalizeSeasonSnapshot(snapshot, season);
  try {
    await writeCacheRecord(snapshot, cacheGeneration);
  } catch {
    // A cache write failure does not prevent using the downloaded data.
  }
  return snapshot;
}

function applySeasonSnapshot(snapshot, season = Number(snapshot.season) || DATA.season) {
  const { games, teams } = normalizeSeasonSnapshot(snapshot, season);

  state.games = games;
  state.teams = teams;
  restoreRevealedGames();
  const weekTargets = scheduleWeekTargets(state.games);
  state.currentWeek = weekTargets.currentWeek;
  state.focusWeek = weekTargets.focusWeek;
  if (state.focusWeek !== null) state.expandedWeeks.add(state.focusWeek);
}

function normalizeSeasonSnapshot(snapshot, season = Number(snapshot.season) || DATA.season) {
  const games = normalizeGames(parseCsv(snapshot.gamesCsv), season);
  const seasonTeams = new Set(games.flatMap((game) => [game.awayTeam, game.homeTeam]));
  const teams = normalizeTeams(parseCsv(snapshot.teamsCsv), seasonTeams);
  if (games.length === 0 || teams.size === 0) throw new Error("NFL data was empty");
  return { games, teams };
}

document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    window.history.replaceState(null, "", state.view === "standings" ? "#standings" : "#schedule");
    render({ scrollToCurrentWeek: state.view === "schedule" });
  });
});

seasonSelect.addEventListener("change", () => {
  const season = Number(seasonSelect.value);
  if (!availableSeasons(publishedManifest).includes(season)) return;

  DATA.season = season;
  saveSelectedSeason(season);
  state.revealed.clear();
  state.games = [];
  state.teams.clear();
  state.currentWeek = null;
  state.focusWeek = null;
  state.expandedWeeks.clear();
  seasonSelect.disabled = true;
  error.hidden = true;
  content.hidden = true;
  loading.textContent = `Loading ${season} data...`;
  loading.hidden = false;

  loadSeasonData(season, publishedManifest)
    .then(() => {
      if (DATA.season !== season) return;
      seasonSelect.disabled = false;
      loading.hidden = true;
      render({ scrollToCurrentWeek: state.view === "schedule" });
    })
    .catch((loadError) => {
      if (DATA.season !== season) return;
      seasonSelect.disabled = false;
      loading.hidden = true;
      error.textContent = `Unable to load NFL data. ${loadError.message}`;
      error.hidden = false;
    });
});

window.addEventListener("hashchange", () => {
  state.view = window.location.hash === "#standings" ? "standings" : "schedule";
  if (state.games.length) render({ scrollToCurrentWeek: state.view === "schedule" });
});

function hasAcceptedStorageNotice() {
  try {
    return localStorage.getItem(STORAGE_NOTICE_ACCEPTED_KEY) === "accepted";
  } catch {
    return false;
  }
}

function startApp() {
  loading.textContent = "Loading NFL data...";
  loadData()
    .then(() => {
      loading.hidden = true;
      render({ scrollToCurrentWeek: state.view === "schedule" });
    })
    .catch((loadError) => {
      loading.hidden = true;
      error.textContent = `Unable to load NFL data. ${loadError.message}`;
      error.hidden = false;
    });
}

document.querySelector("#continue-storage-notice").addEventListener("click", () => {
  try {
    localStorage.setItem(STORAGE_NOTICE_ACCEPTED_KEY, "accepted");
  } catch {
    // The app can still run for this visit if browser storage is unavailable.
  }
  storageNotice.close();
  startApp();
});

document.querySelector("#leave-storage-notice").addEventListener("click", () => {
  window.location.replace("about:blank");
});

storageNotice.addEventListener("cancel", (event) => event.preventDefault());

if (hasAcceptedStorageNotice()) {
  startApp();
} else {
  loading.textContent = "Review the browser storage notice to continue.";
  storageNotice.showModal();
}
