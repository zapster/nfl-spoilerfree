export function streakLabel(history) {
  if (history.length === 0) return "-";

  let latestIndex = history.length - 1;
  while (latestIndex >= 0 && history[latestIndex].result === null) latestIndex -= 1;
  if (latestIndex < 0) return "?";

  const latest = history[latestIndex].result;
  const hasHiddenLaterGames = latestIndex < history.length - 1;
  let count = 1;
  let index = latestIndex - 1;
  while (index >= 0 && history[index].result === latest) {
    count += 1;
    index -= 1;
  }
  if (index >= 0 && history[index].result === null) return `${latest}?`;
  return `${latest}${count}${hasHiddenLaterGames ? "?" : ""}`;
}
