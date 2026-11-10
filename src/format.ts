import type { FirstVisited } from "../shared/visited";

// The date is already the local calendar date, so format it in UTC to avoid shifting it a day.
export function formatFirstVisited(date: FirstVisited) {
  return date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
        dateStyle: "long",
        timeZone: "UTC",
      })
    : "Unknown";
}

export function formatVisitCount(count: number) {
  return count === 1 ? "1 visit" : `${count} visits`;
}

const japaneseDate = new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "UTC" });

/** e.g. 2026年2月16日 */
export function formatFirstVisitedJa(date: FirstVisited) {
  return date ? japaneseDate.format(new Date(`${date}T00:00:00Z`)) : "不明";
}

/** e.g. 11回訪問 */
export function formatVisitCountJa(count: number) {
  return `${count}回訪問`;
}
