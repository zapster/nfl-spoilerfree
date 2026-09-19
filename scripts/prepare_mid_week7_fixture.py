#!/usr/bin/env python3
"""Prepare a source-compatible NFLverse snapshot from the 2025 season."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data" / "source"
FIXTURE_DIR = ROOT / "data" / "fixtures" / "2025-mid-week-7"
MANIFEST_PATH = ROOT / "data" / "fixtures" / "2025-mid-week-7.manifest.json"

GAMES_SOURCE_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "schedules/games.csv"
)
TEAMS_SOURCE_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "teams/teams_colors_logos.csv"
)

SEASON = 2025
GAME_TYPE = "REG"
TIME_ZONE = ZoneInfo("America/New_York")
CUTOFF = datetime(2025, 10, 17, 0, 0, tzinfo=TIME_ZONE)

# These fields can contain a result, postgame observation, or information that
# was only known after the game. Keep the original CSV schema but blank them for
# games that had not started at the snapshot cutoff.
HIDE_AFTER_CUTOFF = {
    "away_score",
    "home_score",
    "result",
    "total",
    "overtime",
    "away_qb_id",
    "home_qb_id",
    "away_qb_name",
    "home_qb_name",
    "away_coach",
    "home_coach",
    "referee",
    "temp",
    "wind",
    "away_moneyline",
    "home_moneyline",
    "spread_line",
    "away_spread_odds",
    "home_spread_odds",
    "total_line",
    "under_odds",
    "over_odds",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def kickoff(row: dict[str, str]) -> datetime:
    value = f"{row['gameday']} {row['gametime']}"
    return datetime.strptime(value, "%Y-%m-%d %H:%M").replace(tzinfo=TIME_ZONE)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        rows = list(reader)
        if reader.fieldnames is None:
            raise ValueError(f"CSV has no header: {path}")
        return reader.fieldnames, rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def prepare_games() -> tuple[int, int, int, list[str]]:
    fieldnames, source_rows = read_csv(SOURCE_DIR / "games.csv")
    rows = [
        row
        for row in source_rows
        if row["season"] == str(SEASON) and row["game_type"] == GAME_TYPE
    ]
    rows.sort(key=lambda row: (row["gameday"], row["gametime"], row["game_id"]))

    if len(rows) != 272:
        raise ValueError(f"Expected 272 regular-season games, found {len(rows)}")

    completed = 0
    scheduled = 0
    team_abbreviations: set[str] = set()
    for row in rows:
        team_abbreviations.update((row["away_team"], row["home_team"]))
        if kickoff(row) <= CUTOFF:
            if not row["away_score"] or not row["home_score"]:
                raise ValueError(f"Missing completed score at cutoff: {row['game_id']}")
            completed += 1
            continue

        scheduled += 1
        for field in HIDE_AFTER_CUTOFF:
            if field in row:
                row[field] = ""

    write_csv(FIXTURE_DIR / "games.csv", fieldnames, rows)
    return len(rows), completed, scheduled, sorted(team_abbreviations)


def prepare_teams(team_abbreviations: list[str]) -> int:
    fieldnames, source_rows = read_csv(SOURCE_DIR / "teams_colors_logos.csv")
    by_abbreviation = {row["team_abbr"]: row for row in source_rows}
    missing = sorted(set(team_abbreviations) - set(by_abbreviation))
    if missing:
        raise ValueError(f"Missing team metadata: {', '.join(missing)}")

    rows = [by_abbreviation[abbreviation] for abbreviation in team_abbreviations]
    write_csv(FIXTURE_DIR / "teams_colors_logos.csv", fieldnames, rows)
    return len(rows)


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    game_count, completed, scheduled, team_abbreviations = prepare_games()
    team_count = prepare_teams(team_abbreviations)

    generated_files = {
        "games.csv": sha256(FIXTURE_DIR / "games.csv"),
        "teams_colors_logos.csv": sha256(FIXTURE_DIR / "teams_colors_logos.csv"),
    }
    source_files = {
        "games.csv": {
            "url": GAMES_SOURCE_URL,
            "sha256": sha256(SOURCE_DIR / "games.csv"),
        },
        "teams_colors_logos.csv": {
            "url": TEAMS_SOURCE_URL,
            "sha256": sha256(SOURCE_DIR / "teams_colors_logos.csv"),
        },
    }
    manifest = {
        "fixture": "2025-mid-week-7",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "snapshotCutoff": CUTOFF.isoformat(),
        "timeZone": "America/New_York",
        "season": SEASON,
        "includedGameType": GAME_TYPE,
        "postseasonIncluded": False,
        "sourceFiles": source_files,
        "generatedFiles": generated_files,
        "counts": {
            "regularSeasonGames": game_count,
            "completedGames": completed,
            "scheduledGames": scheduled,
            "teams": team_count,
        },
        "teams": team_abbreviations,
        "masking": {
            "description": "Rows after the cutoff retain schedule fields and have result-bearing fields blanked.",
            "scoresRetainedThroughCutoff": True,
            "externalLogos": True,
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
