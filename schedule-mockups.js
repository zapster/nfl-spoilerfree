const games = [
  { id: "demo-1", day: "Thursday", date: "Oct 23", kickoff: "8:15 PM", away: { abbr: "MIN", name: "Vikings", color: "#4f2683" }, home: { abbr: "LAC", name: "Chargers", color: "#0080c6" }, status: "final", awayScore: 24, homeScore: 20, revealed: false },
  { id: "demo-2", day: "Sunday", date: "Oct 26", kickoff: "1:00 PM", away: { abbr: "CHI", name: "Bears", color: "#0b162a" }, home: { abbr: "BAL", name: "Ravens", color: "#241773" }, status: "scheduled" },
  { id: "demo-3", day: "Sunday", date: "Oct 26", kickoff: "1:00 PM", away: { abbr: "CAR", name: "Panthers", color: "#0085ca" }, home: { abbr: "BUF", name: "Bills", color: "#00338d" }, status: "scheduled" },
  { id: "demo-4", day: "Sunday", date: "Oct 26", kickoff: "1:00 PM", away: { abbr: "NYJ", name: "Jets", color: "#125740" }, home: { abbr: "CIN", name: "Bengals", color: "#fb4f14" }, status: "final", awayScore: 17, homeScore: 23, revealed: true },
  { id: "demo-5", day: "Sunday", date: "Oct 26", kickoff: "4:25 PM", away: { abbr: "GB", name: "Packers", color: "#203731" }, home: { abbr: "PIT", name: "Steelers", color: "#ffb612" }, status: "scheduled" },
  { id: "demo-6", day: "Sunday", date: "Oct 26", kickoff: "8:20 PM", away: { abbr: "KC", name: "Chiefs", color: "#e31837" }, home: { abbr: "DEN", name: "Broncos", color: "#fb4f14" }, status: "scheduled" },
  { id: "demo-7", day: "Monday", date: "Oct 27", kickoff: "8:15 PM", away: { abbr: "NYG", name: "Giants", color: "#0b2265" }, home: { abbr: "PHI", name: "Eagles", color: "#004c54" }, status: "scheduled" },
  { id: "demo-8", day: "Monday", date: "Oct 27", kickoff: "10:15 PM", away: { abbr: "DAL", name: "Cowboys", color: "#003594" }, home: { abbr: "SF", name: "49ers", color: "#aa0000" }, status: "final", awayScore: 27, homeScore: 24, revealed: false },
];

const variantDetails = {
  cards: {
    label: "tab-cards",
    title: "A. Tighter cards",
    description: "A light-touch pass: keep the separate game cards, but trim their padding, height, and gaps.",
  },
  "week-panel": {
    label: "tab-week-panel",
    title: "B. One week panel",
    description: "Keep the week as the visual unit, with compact matchup rows and dividers inside one shared surface.",
  },
  "day-list": {
    label: "tab-day-list",
    title: "C. Day-grouped list",
    description: "Group by kickoff day so the date appears once, then scan game times and matchups in a denser list.",
  },
};

const revealed = new Set(games.filter((game) => game.revealed).map((game) => game.id));
const picker = document.querySelector(".mockup-picker");
const stage = document.querySelector(".mockup-stage");
const stream = document.querySelector("#week-stream");
const title = document.querySelector("#variant-title");
const description = document.querySelector("#variant-description");
let activeVariant = "day-list";

function makeTeam(team, home) {
  const identity = document.createElement("span");
  identity.className = `team${home ? " home" : ""}`;
  identity.setAttribute("role", "group");
  identity.setAttribute("aria-label", `${team.name}, ${team.abbr}`);
  identity.title = `${team.name} (${team.abbr})`;

  const mark = document.createElement("span");
  mark.className = "team-mark";
  mark.style.setProperty("--team-color", team.color);
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = team.name.slice(0, 1).toUpperCase();

  const longName = document.createElement("span");
  longName.className = "team-long";
  longName.textContent = team.name;

  const shortName = document.createElement("span");
  shortName.className = "team-short";
  shortName.textContent = team.abbr;

  identity.append(...(home ? [longName, shortName, mark] : [mark, longName, shortName]));
  return identity;
}

function makeGame(game, variant) {
  const card = document.createElement("article");
  card.className = "game-card";

  const time = document.createElement("div");
  time.className = "game-time";
  if (variant === "day-list") {
    const kickoff = document.createElement("span");
    kickoff.className = "game-kickoff";
    kickoff.textContent = game.kickoff;
    time.append(kickoff);
  } else {
    const status = document.createElement("strong");
    status.className = game.status === "final" ? "is-final" : "is-scheduled";
    status.textContent = game.status === "final" ? "Final" : "Scheduled";
    time.append(status, document.createTextNode(`${game.day.slice(0, 3)} · ${game.kickoff}`));
  }

  const matchup = document.createElement("div");
  matchup.className = "matchup";
  matchup.append(makeTeam(game.away, false));

  if (game.status === "final") {
    const score = document.createElement("button");
    score.className = `game-score${revealed.has(game.id) ? " is-revealed" : ""}`;
    score.type = "button";
    score.textContent = revealed.has(game.id) ? `${game.awayScore} - ${game.homeScore}` : "-";
    score.setAttribute("aria-label", `${revealed.has(game.id) ? "Hide" : "Reveal"} demo score for ${game.away.name} at ${game.home.name}`);
    score.title = "Demo score; reveal state is temporary";
    score.dataset.demoGame = game.id;
    score.addEventListener("click", () => {
      if (revealed.has(game.id)) revealed.delete(game.id);
      else revealed.add(game.id);
      render();
      stream.querySelector(`[data-demo-game="${game.id}"]`)?.focus({ preventScroll: true });
    });
    matchup.append(score);
  } else {
    const score = document.createElement("span");
    score.className = "game-score is-scheduled";
    score.textContent = "-";
    score.setAttribute("aria-label", "No score; game is scheduled");
    matchup.append(score);
  }

  matchup.append(makeTeam(game.home, true));
  card.append(time, matchup);
  return card;
}

function makeWeek(variant) {
  const week = document.createElement("details");
  week.className = `week-block is-current mockup-${variant}`;
  week.open = true;

  const summary = document.createElement("summary");
  summary.className = "week-summary";
  const copy = document.createElement("span");
  copy.className = "week-summary-copy";
  copy.innerHTML = '<span class="week-title">Week 8 <span class="mockup-example-pill">Example</span></span><span class="week-date">Oct 23 - 27</span>';

  const actions = document.createElement("span");
  actions.className = "week-summary-actions";
  const revealAll = document.createElement("button");
  revealAll.className = "uncover-all";
  revealAll.type = "button";
  revealAll.dataset.revealAll = "true";
  const completed = games.filter((game) => game.status === "final");
  const allRevealed = completed.every((game) => revealed.has(game.id));
  revealAll.textContent = allRevealed ? "Hide all" : "Reveal all";
  revealAll.setAttribute("aria-label", `${allRevealed ? "Hide" : "Reveal"} all ${completed.length} demo scores`);
  revealAll.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (allRevealed) completed.forEach((game) => revealed.delete(game.id));
    else completed.forEach((game) => revealed.add(game.id));
    render();
    stream.querySelector("[data-reveal-all]")?.focus({ preventScroll: true });
  });

  const count = document.createElement("span");
  count.className = "week-count";
  count.textContent = `${revealed.size}/${games.length}`;
  count.setAttribute("aria-label", `${revealed.size} of ${games.length} demo games revealed`);
  const toggle = document.createElement("span");
  toggle.className = "week-toggle";
  toggle.setAttribute("aria-hidden", "true");
  actions.append(revealAll, count, toggle);
  summary.append(copy, actions);
  week.append(summary);

  if (variant === "day-list") {
    const days = new Map();
    games.forEach((game) => {
      const key = `${game.day}|${game.date}`;
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(game);
    });
    days.forEach((dayGames, key) => {
      const [dayName, date] = key.split("|");
      const daySection = document.createElement("section");
      daySection.className = "fixture-day";
      const heading = document.createElement("h3");
      heading.className = "fixture-day-heading";
      heading.innerHTML = `<span>${dayName}</span><span>${date}</span>`;
      daySection.append(heading, ...dayGames.map((game) => makeGame(game, variant)));
      week.append(daySection);
    });
  } else {
    const list = document.createElement("div");
    list.className = `games ${variant === "cards" ? "variant-cards" : "preview-games"}`;
    games.forEach((game) => list.append(makeGame(game, variant)));
    week.append(list);
  }
  return week;
}

function render() {
  const detail = variantDetails[activeVariant];
  title.textContent = detail.title;
  description.textContent = detail.description;
  stage.setAttribute("aria-labelledby", detail.label);
  stream.replaceChildren(makeWeek(activeVariant));
}

function selectVariant(variant, focus = false) {
  activeVariant = variant;
  picker.querySelectorAll("[role=tab]").forEach((tab) => {
    const selected = tab.dataset.variant === variant;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  render();
}

picker.addEventListener("click", (event) => {
  const tab = event.target.closest("[role=tab]");
  if (tab) selectVariant(tab.dataset.variant);
});

picker.addEventListener("keydown", (event) => {
  const tabs = [...picker.querySelectorAll("[role=tab]")];
  const currentIndex = tabs.findIndex((tab) => tab.dataset.variant === activeVariant);
  let nextIndex;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  if (nextIndex !== undefined) {
    event.preventDefault();
    selectVariant(tabs[nextIndex].dataset.variant, true);
  }
});

render();
