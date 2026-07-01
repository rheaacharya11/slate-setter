import {
  getWeekendSummaries, getAvailableYears,
  getFutureWeekendsByYear, getFutureAvailableYears, getAllFutureReleases, isMajorStudio,
} from "@/lib/data";
import CalendarHeatmap from "@/components/CalendarHeatmap";
import MovieTimelineView from "@/components/MovieTimelineView";
import IntentSelector from "@/components/IntentSelector";
import StudioFilter from "@/components/StudioFilter";
import { formatGross } from "@/lib/format";
import { scoreGrade } from "@/lib/scoring";
import type { Genre } from "@/lib/genres";
import { ALL_GENRES } from "@/lib/genres";

interface Props {
  searchParams: Promise<{ year?: string; genre?: string; studios?: string }>;
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;

  const historicalYears = getAvailableYears();
  const futureYears = getFutureAvailableYears();
  const defaultYear = futureYears[0] ?? historicalYears[0] ?? new Date().getFullYear();
  const year = params.year ? parseInt(params.year, 10) : defaultYear;
  const isFuture = futureYears.includes(year);

  const rawGenre = params.genre ?? null;
  const genre: Genre | null =
    rawGenre && (ALL_GENRES as readonly string[]).includes(rawGenre)
      ? (rawGenre as Genre)
      : null;

  const majorStudiosOnly = params.studios === "major";

  // ── Data ──────────────────────────────────────────────────────────────────

  const futureSummaries = isFuture ? getFutureWeekendsByYear(year, genre, { majorStudiosOnly }) : [];
  const futureReleases = isFuture
    ? getAllFutureReleases()
        .filter(r => r.year === year)
        .filter(r => !majorStudiosOnly || isMajorStudio(r.distributor))
    : [];
  const historicalSummaries = isFuture ? [] : getWeekendSummaries(year, genre);

  function getSeason(dateStr: string): "Winter" | "Spring" | "Summer" | "Fall" {
    const month = new Date(dateStr).getUTCMonth() + 1;
    if (month <= 2 || month === 12) return "Winter";
    if (month <= 5) return "Spring";
    if (month <= 8) return "Summer";
    return "Fall";
  }

  const SEASONS = ["Winter", "Spring", "Summer", "Fall"] as const;

  const summaries = isFuture ? futureSummaries : historicalSummaries;
  const bestBySeasonMap = new Map<string, typeof summaries[number]>();
  for (const s of summaries) {
    const season = getSeason(s.startDate);
    const cur = bestBySeasonMap.get(season);
    const score = genre ? (s.genreScore ?? s.score) : s.score;
    const curScore = cur ? (genre ? (cur.genreScore ?? cur.score) : cur.score) : -1;
    if (score > curScore) bestBySeasonMap.set(season, s);
  }
  const bestBySeason = SEASONS.map(season => ({ season, weekend: bestBySeasonMap.get(season) ?? null }));

  const totalMarket = historicalSummaries.reduce((s, w) => s + w.totalGross, 0);

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">

      {/* Intent selector */}
      <div className="mb-12">
        <IntentSelector
          genre={genre}
          year={year}
          futureYears={futureYears}
          historicalYears={historicalYears}
          studiosOnly={majorStudiosOnly}
        />
        {isFuture && (
          <div className="mt-4 flex items-center gap-3">
            <StudioFilter active={majorStudiosOnly} year={year} genre={genre} />
            {majorStudiosOnly && (
              <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider">
                Counting competition from major studios only
              </span>
            )}
          </div>
        )}
        {!isFuture && (
          <p className="text-sm text-[#6b6b6b] mt-2">
            {historicalSummaries.length} weekends · {formatGross(totalMarket)} total market
          </p>
        )}
      </div>

      {/* Suggested weekends strip */}
      <div className="mb-8 border border-[#e5e5e5] bg-[#fafaf9] px-4 py-3">
        <p className="text-[9px] tracking-[0.2em] uppercase text-[#9b9b9b] mb-2">
          {isFuture
            ? genre
              ? `Top slots for a ${genre} film`
              : `Highest-opportunity weekends in ${year}`
            : genre
              ? `Best slots for a ${genre} film`
              : "Best slot scores"}
        </p>
        <div className="flex flex-wrap gap-2">
          {topSlots.map((s, i) => {
            const score = genre ? (s.genreScore ?? s.score) : s.score;
            const { grade, color } = scoreGrade(score);
            return (
              <div
                key={s.id}
                className="flex items-center gap-1.5 border border-[#e5e5e5] bg-white px-2.5 py-1"
              >
                <span className="text-[9px] text-[#c0c0c0] tabular-nums">{i + 1}</span>
                <span className="text-[11px] text-[#0a0a0a]">{s.dateRange}</span>
                {s.marquee && (
                  <span className="text-[9px] text-[#b8860b]">{s.marquee}</span>
                )}
                {genre && (s.genreThreatCount ?? 0) > 0 && (
                  <span className="text-[9px] text-[#b8860b]">{s.genreThreatCount}⚠</span>
                )}
                <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{grade} {score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main visualization */}
      <div className="mb-16">
        {isFuture
          ? <MovieTimelineView
              weekends={futureSummaries}
              releases={futureReleases}
              genreMode={!!genre}
              genre={genre}
              year={year}
            />
          : <CalendarHeatmap data={historicalSummaries} genreMode={!!genre} />
        }
      </div>
    </div>
  );
}
