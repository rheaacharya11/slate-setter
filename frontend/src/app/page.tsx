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

  type Season = "Winter" | "Spring" | "Summer" | "Fall";
  function weekToSeason(week: number): Season {
    if (week <= 8 || week >= 48) return "Winter";
    if (week <= 21) return "Spring";
    if (week <= 35) return "Summer";
    return "Fall";
  }

  const SEASONS: Season[] = ["Winter", "Spring", "Summer", "Fall"];

  type AnySummary = typeof futureSummaries[number] | typeof historicalSummaries[number];
  const summaries: AnySummary[] = isFuture ? futureSummaries : historicalSummaries;
  const topBySeasonMap = new Map<Season, AnySummary[]>();
  for (const season of SEASONS) topBySeasonMap.set(season, []);
  for (const s of summaries) {
    const season = weekToSeason(s.week);
    topBySeasonMap.get(season)!.push(s);
  }
  const topBySeason = SEASONS.map(season => ({
    season,
    weekends: (topBySeasonMap.get(season) ?? [])
      .sort((a, b) => (genre ? (b.genreScore ?? b.score) - (a.genreScore ?? a.score) : b.score - a.score))
      .slice(0, 3),
  }));

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

      {/* Best weekends by season */}
      <div className="mb-8 grid grid-cols-4 gap-px bg-[#e5e5e5] border border-[#e5e5e5]">
        {topBySeason.map(({ season, weekends }) => (
          <div key={season} className="bg-white px-3 py-2.5">
            <p className="text-[9px] tracking-[0.2em] uppercase text-[#9b9b9b] mb-2">{season}</p>
            <div className="space-y-1.5">
              {weekends.map((s, i) => {
                const score = genre ? (s.genreScore ?? s.score) : s.score;
                const { grade, color } = scoreGrade(score);
                return (
                  <div key={s.id} className="flex items-baseline gap-1.5">
                    <span className="text-[9px] text-[#d0d0d0] tabular-nums shrink-0">{i + 1}</span>
                    <span className="text-[11px] text-[#0a0a0a] flex-1 min-w-0 truncate">{s.dateLabel}</span>
                    {s.marquee && (
                      <span className="text-[9px] text-[#b8860b] shrink-0 truncate max-w-[60px]">{s.marquee}</span>
                    )}
                    <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color }}>{grade} {score}</span>
                  </div>
                );
              })}
              {weekends.length === 0 && (
                <p className="text-[10px] text-[#c0c0c0]">No data</p>
              )}
            </div>
          </div>
        ))}
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
