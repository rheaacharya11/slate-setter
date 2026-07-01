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
import Link from "next/link";

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

  // Ranked recommendations
  const topSlots = isFuture
    ? [...futureSummaries]
        .sort((a, b) => (b.genreScore ?? b.score) - (a.genreScore ?? a.score))
        .slice(0, 5)
    : genre
      ? [...historicalSummaries]
          .sort((a, b) => (b.genreScore ?? b.score) - (a.genreScore ?? a.score))
          .slice(0, 5)
      : [...historicalSummaries]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

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

      {/* Recommendations footer */}
      <div className="border-t border-[#e5e5e5] pt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Best slots */}
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#6b6b6b] mb-6">
              {isFuture
                ? genre
                  ? `Recommended slots for a ${genre} film`
                  : `Highest-opportunity weekends in ${year}`
                : genre
                  ? `Best slots for a ${genre} film`
                  : "Best slot scores"}
            </p>
            <div>
              {topSlots.map((s, i) => {
                const score = genre
                  ? (s.genreScore ?? s.score)
                  : s.score;
                const { grade, color } = scoreGrade(score);
                const href = isFuture
                  ? `/compare?mode=upcoming&w1=${s.id}`
                  : `/weekend/${s.id}`;
                return (
                  <Link
                    key={s.id}
                    href={href}
                    className="flex items-baseline gap-4 py-3 border-b border-[#f0f0f0] hover:bg-[#fafaf9] -mx-2 px-2 transition-colors"
                  >
                    <span className="text-xs text-[#c0c0c0] w-4 shrink-0 tabular-nums">{i + 1}</span>
                    <span className="text-sm text-[#0a0a0a] flex-1 min-w-0 truncate">{s.dateRange}</span>
                    {s.marquee && (
                      <span className="text-[10px] tracking-wider text-[#b8860b] shrink-0">{s.marquee}</span>
                    )}
                    {genre && (s.genreThreatCount ?? 0) > 0 && (
                      <span className="text-[10px] text-[#b8860b] shrink-0">{s.genreThreatCount}⚠</span>
                    )}
                    <span className="font-bold text-sm shrink-0" style={{ color }}>
                      {grade} ({score})
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Genre competition or historical context */}
          {isFuture && genre ? (
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#6b6b6b] mb-6">
                Weeks with {genre} competition
              </p>
              <div>
                {futureSummaries
                  .filter(s => (s.genreThreatCount ?? 0) > 0)
                  .sort((a, b) => (b.genreThreatCount ?? 0) - (a.genreThreatCount ?? 0))
                  .slice(0, 6)
                  .map(s => (
                    <Link
                      key={s.id}
                      href={`/compare?mode=upcoming&w1=${s.id}`}
                      className="flex items-baseline gap-4 py-3 border-b border-[#f0f0f0] hover:bg-[#fafaf9] -mx-2 px-2 transition-colors"
                    >
                      <span className="text-[10px] text-[#b8860b] shrink-0 w-4 tabular-nums">
                        {s.genreThreatCount}⚠
                      </span>
                      <span className="text-sm text-[#0a0a0a] flex-1 min-w-0 truncate">{s.dateRange}</span>
                      <span className="text-xs text-[#9b9b9b] shrink-0">{s.wideCount} wide</span>
                    </Link>
                  ))}
                {futureSummaries.every(s => !(s.genreThreatCount ?? 0)) && (
                  <p className="text-sm text-emerald-600 py-4">No identified {genre} competition in {year}.</p>
                )}
              </div>
            </div>
          ) : isFuture ? (
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#6b6b6b] mb-6">
                Holiday weekends in {year}
              </p>
              <div>
                {futureSummaries.filter(s => s.marquee).map(s => {
                  const { grade, color } = scoreGrade(s.score);
                  return (
                    <Link
                      key={s.id}
                      href={`/compare?mode=upcoming&w1=${s.id}`}
                      className="flex items-baseline gap-4 py-3 border-b border-[#f0f0f0] hover:bg-[#fafaf9] -mx-2 px-2 transition-colors"
                    >
                      <span className="text-[10px] tracking-wider text-[#b8860b] shrink-0 w-28 truncate">{s.marquee}</span>
                      <span className="text-sm text-[#0a0a0a] flex-1 min-w-0 truncate">{s.dateRange}</span>
                      <span className="font-bold text-sm shrink-0" style={{ color }}>{grade} ({s.score})</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#6b6b6b] mb-6">
                Holiday & marquee weekends
              </p>
              <div>
                {historicalSummaries.filter(s => s.marquee).map(s => (
                  <Link
                    key={s.id}
                    href={`/weekend/${s.id}`}
                    className="flex items-baseline gap-4 py-3 border-b border-[#f0f0f0] hover:bg-[#fafaf9] -mx-2 px-2 transition-colors"
                  >
                    <span className="text-[10px] tracking-wider text-[#b8860b] shrink-0 w-28 truncate">{s.marquee}</span>
                    <span className="text-sm text-[#0a0a0a] flex-1 min-w-0 truncate">{s.dateRange}</span>
                    <span className="font-serif font-bold text-sm text-[#0a0a0a] shrink-0">{formatGross(s.totalGross)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
