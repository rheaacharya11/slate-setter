import type { ScoreBreakdown } from "./scoring";

export interface ScheduledRelease {
  film: string;
  distributor: string | null;
  releaseDate: string; // ISO date
  isWide: boolean;
  genre: string | null;
  subgenre: string | null;
  synopsis: string | null;
  runningTime: string | null;
  productionBudget: number | null;
}

export interface ReleaseWithWeek extends ScheduledRelease {
  weekId: string;
  year: number;
  week: number;
  startDate: string;
  historicalAvgGross: number;
}

export interface FutureWeekendSummary {
  id: string;          // "2026W27"
  year: number;
  week: number;
  dateLabel: string;
  dateRange: string;
  startDate: string;   // ISO date of the Friday
  wideCount: number;
  historicalAvgGross: number;
  marquee: string | null;
  score: number;
  holdoverEffective: number; // decay-weighted holdover competition from prior weeks
  genreScore?: number;       // genre-adjusted score (only when genre context provided)
  genreThreatCount?: number;
}

export interface FutureWeekendDetail extends FutureWeekendSummary {
  scheduledReleases: ScheduledRelease[];
  historicalWeeks: number; // how many past years of data for this week-of-year
}

export interface FilmRecord {
  source_url: string;
  film: string;
  weekend_gross: number | null;
  theater_count: number | null;
  total_gross_to_date: number | null;
  week_number_in_release: number | null;
  distributor: string | null;
  year: number;
  week_of_year: number;
  genre: string | null;
  marquee_weekend: string | null;
  is_new_release: boolean;
}

export interface WeekendSummary {
  id: string;        // "2024W07"
  year: number;
  week: number;
  dateLabel: string; // "Feb 9"
  dateRange: string; // "Feb 9–11, 2024"
  totalGross: number;
  filmCount: number;
  topFilm: string;
  marquee: string | null;
  score: number;             // base slot attractiveness 0–100
  genreScore?: number;       // genre-adjusted score (only when genre context provided)
  genreThreatCount?: number; // # of same-genre films competing
}

export interface AdjacentWeekend {
  id: string;
  dateLabel: string;
  dateRange: string;
  totalGross: number;
  score: number;
  marquee: string | null;
}

export interface WeekendDetail {
  id: string;
  year: number;
  week: number;
  dateLabel: string;
  dateRange: string;
  totalGross: number;
  filmCount: number;
  marquee: string | null;
  openers: FilmRecord[];
  holdovers: FilmRecord[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  yearAvgGross: number;
  prevWeekend: AdjacentWeekend | null;
  nextWeekend: AdjacentWeekend | null;
}
