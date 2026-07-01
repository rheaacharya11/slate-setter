import type { FilmRecord } from "./types";
import type { Genre } from "./genres";

export interface ScoreBreakdown {
  marketScore: number;       // market size vs year average
  availabilityScore: number; // share of market not locked up by competition
  holidayBonus: number;      // marquee weekend bonus
}

/**
 * How much "weight" a holdover film exerts on the market.
 * Films in week 4+ have mostly played out and leave more room for new entrants.
 */
function holdoverWeight(film: FilmRecord): number {
  if (film.is_new_release) return 1.0; // week 1: full threat
  const wk = film.week_number_in_release ?? 2;
  if (wk === 2) return 0.85;
  if (wk === 3) return 0.60;
  return 0.35; // wk 4+: mostly spent
}

/**
 * Compute a "slot attractiveness" score (0–100) for a weekend.
 *
 * Score = how much market is available × how large that market is + holiday bonus
 *
 * A big market where incumbents have locked up most of it is still worse than
 * a slightly smaller market with weak competition — this captures that.
 */
export function computeSlotScore({
  totalGross,
  yearAvgGross,
  films,
  marquee,
}: {
  totalGross: number;
  yearAvgGross: number;
  films: FilmRecord[];
  marquee: string | null;
}): { score: number; breakdown: ScoreBreakdown } {
  const empty = { score: 0, breakdown: { marketScore: 0, availabilityScore: 0, holidayBonus: 0 } };
  if (!totalGross || !yearAvgGross) return empty;

  // How big is this market relative to a normal weekend this year?
  const marketRatio = totalGross / yearAvgGross;

  // What share of the market is already committed to existing strong films?
  // Weighted by holdover decay so a wk-4 film penalizes less than a fresh opener.
  let takenShare = 0;
  for (const film of films) {
    const gross = film.weekend_gross ?? 0;
    const rawShare = gross / totalGross;
    if (rawShare < 0.04) continue; // skip tiny limited releases (< 4% share)
    takenShare += rawShare * holdoverWeight(film);
  }

  const availableShare = Math.max(0, 1 - Math.min(takenShare, 1));

  // Opportunity = (available slice) × (how big the pie is)
  const opportunity = availableShare * Math.min(marketRatio, 2.5);

  const holidayBonus = marquee ? 10 : 0;

  const rawScore = opportunity * 70 + holidayBonus;

  return {
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    breakdown: {
      marketScore: Math.round(Math.min(marketRatio * 50, 60)),
      availabilityScore: Math.round(availableShare * 40),
      holidayBonus,
    },
  };
}

/**
 * Adjust a base slot score for a specific genre.
 * Same-genre films are the most direct audience competition —
 * they get a larger penalty than the base formula's holdover-weighted market share.
 */
export function computeGenreAdjustedScore({
  baseScore,
  totalGross,
  films,
  myGenre,
}: {
  baseScore: number;
  totalGross: number;
  films: FilmRecord[];
  myGenre: Genre;
}): { score: number; threatCount: number; threatGross: number } {
  if (!totalGross) return { score: 0, threatCount: 0, threatGross: 0 };

  const genreFilms = films.filter((f) => f.genre === myGenre);

  const genreThreatShare = genreFilms.reduce((sum, f) => {
    const gross = f.weekend_gross ?? 0;
    return sum + (gross / totalGross) * holdoverWeight(f);
  }, 0);

  let genreScore = baseScore;
  // Extra penalty beyond the base formula for direct genre competition
  genreScore -= genreThreatShare * 70;
  // Reward a clear field — no same-genre competition is a meaningful edge
  if (genreFilms.length === 0) genreScore += 8;

  return {
    score: Math.max(0, Math.min(100, Math.round(genreScore))),
    threatCount: genreFilms.length,
    threatGross: genreFilms.reduce((sum, f) => sum + (f.weekend_gross ?? 0), 0),
  };
}

export function scoreGrade(score: number): { grade: string; color: string } {
  if (score >= 60) return { grade: "High", color: "#16a34a" };
  if (score >= 35) return { grade: "Medium", color: "#ca8a04" };
  return { grade: "Low", color: "#dc2626" };
}
