/**
 * Client-safe formatting helpers — no fs, no server imports.
 */

export function formatGross(n: number): string {
  if (n >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Math.round(m)}M`;
  }
  if (n >= 1_000) {
    return `$${Math.round(n / 1_000)}K`;
  }
  return `$${n}`;
}

export function formatGrossLong(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/**
 * Given a box-office "year" and ISO week number, return the Friday of that
 * weekend. The algorithm:
 *   1. Start at Jan 1 of the year.
 *   2. Advance to the first Friday on or after Jan 1.
 *   3. Add (week - 1) * 7 days.
 *
 * Spot-checks:
 *   2024 W06 → Feb 9  (Valentine's weekend)
 *   2022 W51 → Dec 22 (pre-Christmas weekend)
 */
export function getWeekendStartDate(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1); // local time, midnight
  const jan1Day = jan1.getDay(); // 0 = Sun, 5 = Fri

  // Days until the first Friday (0 if Jan 1 is already Friday)
  const daysUntilFriday = (5 - jan1Day + 7) % 7;

  const firstFriday = new Date(year, 0, 1 + daysUntilFriday);
  const targetFriday = new Date(firstFriday);
  targetFriday.setDate(firstFriday.getDate() + (week - 1) * 7);
  return targetFriday;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDateRange(
  year: number,
  week: number
): { label: string; range: string } {
  const friday = getWeekendStartDate(year, week);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  const fMonth = MONTH_ABBR[friday.getMonth()];
  const fDay = friday.getDate();
  const sMonth = MONTH_ABBR[sunday.getMonth()];
  const sDay = sunday.getDate();

  const label = `${fMonth} ${fDay}`;

  const range =
    friday.getMonth() === sunday.getMonth()
      ? `${fMonth} ${fDay}–${sDay}, ${year}`
      : `${fMonth} ${fDay}–${sMonth} ${sDay}, ${year}`;

  return { label, range };
}
