/**
 * Server-only data layer. Uses fs — never import this in 'use client' components.
 */
import fs from "fs";
import path from "path";
import type {
  FilmRecord, WeekendSummary, WeekendDetail, AdjacentWeekend,
  ScheduledRelease, FutureWeekendSummary, FutureWeekendDetail, ReleaseWithWeek,
} from "./types";
import { formatDateRange, getWeekendStartDate } from "./format";
import { inferGenre } from "./genres";
import type { Genre } from "./genres";

function cleanFilmTitle(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
}
import { computeSlotScore, computeGenreAdjustedScore } from "./scoring";

let _cache: FilmRecord[] | null = null;

export function getAllRecords(): FilmRecord[] {
  if (_cache) return _cache;
  const filePath = path.join(process.cwd(), "public", "data", "normalized_weekend_data.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const records = JSON.parse(raw) as FilmRecord[];

  // BOM sometimes scrapes the same weekend via multiple URLs (regular + occasion pages),
  // producing duplicate rows for the same film. Keep whichever has the higher gross.
  const seen = new Map<string, FilmRecord>();
  for (const r of records) {
    const key = `${r.year}:${r.week_of_year}:${r.film}`;
    const existing = seen.get(key);
    if (!existing || (r.weekend_gross ?? 0) > (existing.weekend_gross ?? 0)) {
      seen.set(key, r);
    }
  }

  // Enrich genre from our inferred lookup (scraper leaves this null)
  _cache = Array.from(seen.values()).map((r) => ({
    ...r,
    genre: r.genre ?? inferGenre(r.film) ?? null,
  }));
  return _cache;
}

export function getAvailableYears(): number[] {
  const records = getAllRecords();
  const years = Array.from(new Set(records.map((r) => r.year)));
  return years.sort((a, b) => b - a);
}

/** Average total gross per weekend for a given year. */
function getYearAvgGross(year: number): number {
  const records = getAllRecords().filter((r) => r.year === year);
  const byWeek = new Map<number, number>();
  for (const r of records) {
    byWeek.set(r.week_of_year, (byWeek.get(r.week_of_year) ?? 0) + (r.weekend_gross ?? 0));
  }
  if (byWeek.size === 0) return 1;
  const total = Array.from(byWeek.values()).reduce((s, g) => s + g, 0);
  return total / byWeek.size;
}

export function getWeekendSummaries(year: number, genre?: Genre | null): WeekendSummary[] {
  const records = getAllRecords().filter((r) => r.year === year);
  const yearAvgGross = getYearAvgGross(year);

  // Group by week_of_year
  const byWeek = new Map<number, FilmRecord[]>();
  for (const r of records) {
    const list = byWeek.get(r.week_of_year) ?? [];
    list.push(r);
    byWeek.set(r.week_of_year, list);
  }

  const summaries: WeekendSummary[] = [];

  for (const [week, films] of byWeek) {
    const totalGross = films.reduce((sum, f) => sum + (f.weekend_gross ?? 0), 0);

    const topFilm = films
      .slice()
      .sort((a, b) => (b.weekend_gross ?? 0) - (a.weekend_gross ?? 0))[0]?.film ?? "—";

    const marquee = films.find((f) => f.marquee_weekend)?.marquee_weekend ?? null;
    const { label, range } = formatDateRange(year, week);

    const { score } = computeSlotScore({ totalGross, yearAvgGross, films, marquee });

    const summary: WeekendSummary = {
      id: `${year}W${String(week).padStart(2, "0")}`,
      year,
      week,
      dateLabel: label,
      dateRange: range,
      totalGross,
      filmCount: films.length,
      topFilm,
      marquee,
      score,
    };

    if (genre) {
      const { score: gs, threatCount } = computeGenreAdjustedScore({
        baseScore: score,
        totalGross,
        films,
        myGenre: genre,
      });
      summary.genreScore = gs;
      summary.genreThreatCount = threatCount;
    }

    summaries.push(summary);
  }

  return summaries.sort((a, b) => a.week - b.week);
}

function makeSummaryForWeek(
  year: number,
  week: number,
  films: FilmRecord[],
  yearAvgGross: number
): WeekendSummary | null {
  if (films.length === 0) return null;
  const totalGross = films.reduce((sum, f) => sum + (f.weekend_gross ?? 0), 0);
  const marquee = films.find((f) => f.marquee_weekend)?.marquee_weekend ?? null;
  const { label, range } = formatDateRange(year, week);
  const topFilm = [...films].sort((a, b) => (b.weekend_gross ?? 0) - (a.weekend_gross ?? 0))[0]?.film ?? "—";
  const { score } = computeSlotScore({ totalGross, yearAvgGross, films, marquee });
  return {
    id: `${year}W${String(week).padStart(2, "0")}`,
    year,
    week,
    dateLabel: label,
    dateRange: range,
    totalGross,
    filmCount: films.length,
    topFilm,
    marquee,
    score,
  };
}

export function getWeekendDetail(year: number, week: number): WeekendDetail | null {
  const allRecords = getAllRecords();
  const records = allRecords.filter(
    (r) => r.year === year && r.week_of_year === week
  );

  if (records.length === 0) return null;

  const yearAvgGross = getYearAvgGross(year);
  const totalGross = records.reduce((sum, f) => sum + (f.weekend_gross ?? 0), 0);
  const marquee = records.find((f) => f.marquee_weekend)?.marquee_weekend ?? null;
  const { label, range } = formatDateRange(year, week);

  const sorted = records.slice().sort((a, b) => (b.weekend_gross ?? 0) - (a.weekend_gross ?? 0));
  const openers = sorted.filter((f) => f.is_new_release);
  const holdovers = sorted.filter((f) => !f.is_new_release);

  const { score, breakdown } = computeSlotScore({
    totalGross,
    yearAvgGross,
    films: records,
    marquee,
  });

  // Adjacent weekends
  const byWeek = new Map<number, FilmRecord[]>();
  for (const r of allRecords.filter((r) => r.year === year)) {
    const list = byWeek.get(r.week_of_year) ?? [];
    list.push(r);
    byWeek.set(r.week_of_year, list);
  }
  const allWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
  const idx = allWeeks.indexOf(week);

  function toAdjacent(s: WeekendSummary): AdjacentWeekend {
    return { id: s.id, dateLabel: s.dateLabel, dateRange: s.dateRange, totalGross: s.totalGross, score: s.score, marquee: s.marquee };
  }

  const prevWeek = idx > 0 ? allWeeks[idx - 1] : null;
  const nextWeek = idx < allWeeks.length - 1 ? allWeeks[idx + 1] : null;

  const prevSummary = prevWeek != null
    ? makeSummaryForWeek(year, prevWeek, byWeek.get(prevWeek) ?? [], yearAvgGross)
    : null;
  const nextSummary = nextWeek != null
    ? makeSummaryForWeek(year, nextWeek, byWeek.get(nextWeek) ?? [], yearAvgGross)
    : null;

  return {
    id: `${year}W${String(week).padStart(2, "0")}`,
    year,
    week,
    dateLabel: label,
    dateRange: range,
    totalGross,
    filmCount: records.length,
    marquee,
    openers,
    holdovers,
    score,
    scoreBreakdown: breakdown,
    yearAvgGross,
    prevWeekend: prevSummary ? toAdjacent(prevSummary) : null,
    nextWeekend: nextSummary ? toAdjacent(nextSummary) : null,
  };
}

// ─── Future weekends (Numbers release schedule) ──────────────────────────────

// Distributor substrings that qualify as a "major / tracked studio".
// Matched case-insensitively against the distributor field from The Numbers.
export const MAJOR_STUDIO_SUBSTRINGS = [
  "A24", "Universal", "Walt Disney", "Disney", "Warner Bros",
  "Paramount", "Sony Pictures", "Amazon MGM", "MGM", "Lionsgate",
  "20th Century", "Neon", "Focus Features", "Searchlight",
  "Angel Studios", "Vertical Entertainment", "Bleecker Street",
  "Magnolia Pictures", "Ketchup Entertainment", "Black Bear Pictures",
  "Icon Film", "Godzilla Kingdom", "BBE", "CNV",
];

export function isMajorStudio(distributor: string | null): boolean {
  if (!distributor) return false;
  const d = distributor.toLowerCase();
  return MAJOR_STUDIO_SUBSTRINGS.some(s => d.includes(s.toLowerCase()));
}

interface NumbersRecord {
  release_date: string | null;
  film: string;
  distributor: string | null;
  genre: string | null;
  subgenre: string | null;
  synopsis: string | null;
  running_time: string | null;
  production_budget: number | null;
}

let _numbersCache: NumbersRecord[] | null = null;

function getNumbersRecords(): NumbersRecord[] {
  if (_numbersCache) return _numbersCache;
  const filePath = path.join(process.cwd(), "public", "data", "numbers_release_schedule.json");
  _numbersCache = JSON.parse(fs.readFileSync(filePath, "utf-8")) as NumbersRecord[];
  return _numbersCache;
}

/** Map an ISO date string to the box office week it falls in (same numbering as BOM). */
function dateToWeekOfYear(dateStr: string): { year: number; week: number; fridayDate: Date } {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat

  // Find the Friday of this box office weekend
  // Mon–Thu → advance to next Friday; Fri/Sat/Sun → back to most-recent Friday (or same day)
  let daysToFriday: number;
  if (dow === 5) daysToFriday = 0;         // Friday
  else if (dow === 6) daysToFriday = -1;   // Saturday → previous Friday
  else if (dow === 0) daysToFriday = -2;   // Sunday → previous Friday
  else daysToFriday = 5 - dow;             // Mon(1)→+4, Tue(2)→+3, Wed(3)→+2, Thu(4)→+1

  const friday = new Date(d);
  friday.setDate(d.getDate() + daysToFriday);

  const year = friday.getFullYear();
  // Compute week number: which week is this friday? (same as getWeekendStartDate inverse)
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const daysUntilFirstFriday = (5 - jan1Day + 7) % 7;
  const firstFriday = new Date(year, 0, 1 + daysUntilFirstFriday);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const week = Math.round((friday.getTime() - firstFriday.getTime()) / msPerWeek) + 1;

  return { year, week, fridayDate: friday };
}

/** Known holiday weekends: returns a label if the Fri-Sun period contains a marquee date. */
function getFutureMarquee(friday: Date): string | null {
  const dates = [friday, new Date(friday.getTime() + 86400000), new Date(friday.getTime() + 172800000)];
  for (const d of dates) {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (m === 1 && day === 1) return "New Year's Day";
    if (m === 2 && day === 14) return "Valentine's Day";
    if (m === 7 && day === 4) return "Independence Day";
    if (m === 10 && day === 31) return "Halloween";
    if (m === 12 && day === 25) return "Christmas";
    if (m === 12 && day === 26) return "Christmas";
  }
  // Memorial Day: last Monday of May
  if (dates.some(d => d.getMonth() === 4 && d.getDay() === 1)) {
    // check it's the last Monday
    const mon = dates.find(d => d.getMonth() === 4 && d.getDay() === 1)!;
    const nextMon = new Date(mon.getTime() + 7 * 86400000);
    if (nextMon.getMonth() !== 4) return "Memorial Day";
  }
  // Labor Day: first Monday of September
  if (dates.some(d => d.getMonth() === 8 && d.getDay() === 1)) {
    const mon = dates.find(d => d.getMonth() === 8 && d.getDay() === 1)!;
    if (mon.getDate() <= 7) return "Labor Day";
  }
  // Thanksgiving: 4th Thursday of November → the Friday after is Black Friday weekend
  if (dates.some(d => d.getMonth() === 10 && d.getDay() === 5)) {
    const fri = dates.find(d => d.getMonth() === 10 && d.getDay() === 5)!;
    // The Thursday before: check if it's 4th Thursday of Nov
    const thu = new Date(fri.getTime() - 86400000);
    const thuWeekInMonth = Math.ceil(thu.getDate() / 7);
    if (thuWeekInMonth === 4) return "Thanksgiving";
  }
  return null;
}

/** Historical avg gross for a specific week-of-year, averaged across all years of BOM data. */
function getHistoricalAvgForWeek(week: number): { avg: number; count: number } {
  const records = getAllRecords();
  const byYear = new Map<number, number>();
  for (const r of records) {
    if (r.week_of_year !== week) continue;
    byYear.set(r.year, (byYear.get(r.year) ?? 0) + (r.weekend_gross ?? 0));
  }
  if (byYear.size === 0) return { avg: 0, count: 0 };
  const total = Array.from(byYear.values()).reduce((s, g) => s + g, 0);
  return { avg: Math.round(total / byYear.size), count: byYear.size };
}

/** Overall historical avg gross per weekend (used to normalise marketScore). */
function getOverallHistoricalAvg(): number {
  const records = getAllRecords();
  const byWeekYear = new Map<string, number>();
  for (const r of records) {
    const key = `${r.year}:${r.week_of_year}`;
    byWeekYear.set(key, (byWeekYear.get(key) ?? 0) + (r.weekend_gross ?? 0));
  }
  if (byWeekYear.size === 0) return 1;
  const total = Array.from(byWeekYear.values()).reduce((s, g) => s + g, 0);
  return total / byWeekYear.size;
}

function scoreFutureWeekend(wideCount: number, historicalAvgGross: number, overallAvg: number, marquee: string | null): number {
  const marketRatio = overallAvg > 0 ? historicalAvgGross / overallAvg : 0;
  // Each unique wide film takes a share of audience attention, but with diminishing impact —
  // a 6th wide release doesn't crowd a slot as much as the 2nd one does.
  const takenShare = Math.min(1 - Math.pow(0.82, wideCount), 0.85);
  const availableShare = 1 - takenShare;
  const opportunity = availableShare * Math.min(marketRatio, 2.5);
  const holidayBonus = marquee ? 10 : 0;
  return Math.max(0, Math.min(100, Math.round(opportunity * 70 + holidayBonus)));
}

export function getFutureWeekends(opts: { majorStudiosOnly?: boolean } = {}): FutureWeekendSummary[] {
  const numbers = getNumbersRecords().filter(r => r.release_date);
  const overallAvg = getOverallHistoricalAvg();

  // Group ALL releases by box office week so every weekend appears regardless of studio filter.
  const byWeek = new Map<string, { releases: ScheduledRelease[]; fridayDate: Date; year: number; week: number }>();

  for (const r of numbers) {
    const { year, week, fridayDate } = dateToWeekOfYear(r.release_date!);
    // Only future weeks (starting from today)
    if (fridayDate < new Date(new Date().toDateString())) continue;
    const key = `${year}W${String(week).padStart(2, "0")}`;
    if (!byWeek.has(key)) {
      byWeek.set(key, { releases: [], fridayDate, year, week });
    }
    byWeek.get(key)!.releases.push({
      film: r.film,
      distributor: r.distributor,
      releaseDate: r.release_date!,
      isWide: r.film.includes("(Wide)") || r.film.includes("(IMAX)"),
      genre: r.genre ?? null,
      subgenre: r.subgenre ?? null,
      synopsis: r.synopsis ?? null,
      runningTime: r.running_time ?? null,
      productionBudget: r.production_budget ?? null,
    });
  }

  const summaries: FutureWeekendSummary[] = [];
  for (const [id, { releases, fridayDate, year, week }] of byWeek) {
    const { label, range } = formatDateRange(year, week);

    // When majorStudiosOnly, only count tracked-studio releases toward wideCount/score.
    const releaseSubset = opts.majorStudiosOnly
      ? releases.filter(r => isMajorStudio(r.distributor))
      : releases;

    // Deduplicate IMAX/Wide formats of the same film (e.g. "Minions (Wide)" + "Minions (IMAX)" = 1 film)
    const uniqueWideFilms = new Set(
      releaseSubset.filter(r => r.isWide).map(r => r.film.replace(/\s*\([^)]*\)\s*/g, "").trim())
    );
    const wideCount = uniqueWideFilms.size;
    const marquee = getFutureMarquee(fridayDate);
    const { avg: historicalAvgGross } = getHistoricalAvgForWeek(week);
    const score = scoreFutureWeekend(wideCount, historicalAvgGross, overallAvg, marquee);
    summaries.push({
      id,
      year,
      week,
      dateLabel: label,
      dateRange: range,
      startDate: fridayDate.toISOString().slice(0, 10),
      wideCount,
      historicalAvgGross,
      marquee,
      score,
    });
  }

  return summaries.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function getFutureWeekendDetail(year: number, week: number, opts: { majorStudiosOnly?: boolean } = {}): FutureWeekendDetail | null {
  const id = `${year}W${String(week).padStart(2, "0")}`;
  const summaries = getFutureWeekends(opts);
  const summary = summaries.find(s => s.id === id);
  if (!summary) return null;

  const { count: historicalWeeks } = getHistoricalAvgForWeek(week);

  const numbers = getNumbersRecords().filter(r => r.release_date);
  const releases: ScheduledRelease[] = [];
  for (const r of numbers) {
    const { year: ry, week: rw } = dateToWeekOfYear(r.release_date!);
    if (ry !== year || rw !== week) continue;
    if (opts.majorStudiosOnly && !isMajorStudio(r.distributor)) continue;
    releases.push({
      film: r.film,
      distributor: r.distributor,
      releaseDate: r.release_date!,
      isWide: r.film.includes("(Wide)") || r.film.includes("(IMAX)"),
      genre: r.genre ?? null,
      subgenre: r.subgenre ?? null,
      synopsis: r.synopsis ?? null,
      runningTime: r.running_time ?? null,
      productionBudget: r.production_budget ?? null,
    });
  }

  return {
    ...summary,
    scheduledReleases: releases.sort((a, b) => {
      if (a.isWide !== b.isWide) return a.isWide ? -1 : 1;
      return a.film.localeCompare(b.film);
    }),
    historicalWeeks,
  };
}

/** Future weekends for a specific year, optionally with genre threat counts. */
export function getFutureWeekendsByYear(year: number, genre?: Genre | null, opts: { majorStudiosOnly?: boolean } = {}): FutureWeekendSummary[] {
  const all = getFutureWeekends(opts).filter(w => w.year === year);
  if (!genre) return all;

  const numbers = getNumbersRecords().filter(r => r.release_date);

  return all.map(summary => {
    const { year: wy, week: ww } = { year: summary.year, week: summary.week };
    const threats = numbers.filter(r => {
      if (!r.release_date) return false;
      const { year: ry, week: rw } = dateToWeekOfYear(r.release_date);
      if (ry !== wy || rw !== ww) return false;
      if (opts.majorStudiosOnly && !isMajorStudio(r.distributor)) return false;
      // Prefer scraped genre; fall back to inferred lookup for films without API data
      const filmGenre = r.genre ?? inferGenre(cleanFilmTitle(r.film));
      return filmGenre === genre;
    });
    const threatCount = threats.length;
    // Penalize each genre threat proportionally — treat each as occupying a share of attention.
    // Use same diminishing-returns curve as total wide count, but only for same-genre films.
    const genreTakenShare = Math.min(1 - Math.pow(0.82, threatCount), 0.85);
    let genreScore = summary.score * (1 - genreTakenShare);
    if (threatCount === 0) genreScore = Math.min(100, genreScore + 8); // clear-field bonus
    return {
      ...summary,
      genreScore: Math.max(0, Math.min(100, Math.round(genreScore))),
      genreThreatCount: threatCount,
    };
  });
}

/** All years with future data (from Numbers), for display alongside historical years. */
export function getFutureAvailableYears(): number[] {
  const years = Array.from(new Set(getFutureWeekends().map(w => w.year)));
  return years.sort((a, b) => a - b);
}

/** Flat list of all future scheduled releases, each tagged with their box office week context. */
export function getAllFutureReleases(): ReleaseWithWeek[] {
  const weekends = getFutureWeekends();
  const weekMap = new Map(weekends.map(w => [w.id, w]));
  const numbers = getNumbersRecords().filter(r => r.release_date);
  const results: ReleaseWithWeek[] = [];
  for (const r of numbers) {
    const { year, week, fridayDate } = dateToWeekOfYear(r.release_date!);
    if (fridayDate < new Date(new Date().toDateString())) continue;
    const weekId = `${year}W${String(week).padStart(2, "0")}`;
    const weekSummary = weekMap.get(weekId);
    if (!weekSummary) continue;
    results.push({
      film: r.film,
      distributor: r.distributor,
      releaseDate: r.release_date!,
      isWide: r.film.includes("(Wide)") || r.film.includes("(IMAX)"),
      genre: r.genre ?? null,
      subgenre: r.subgenre ?? null,
      synopsis: r.synopsis ?? null,
      runningTime: r.running_time ?? null,
      productionBudget: r.production_budget ?? null,
      weekId,
      year,
      week,
      startDate: weekSummary.startDate,
      historicalAvgGross: weekSummary.historicalAvgGross,
    });
  }
  return results;
}
