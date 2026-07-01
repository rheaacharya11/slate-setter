import { notFound } from "next/navigation";
import Link from "next/link";
import { getWeekendDetail } from "@/lib/data";
import { formatGross } from "@/lib/format";
import { scoreGrade } from "@/lib/scoring";
import CompetitionLandscape from "@/components/CompetitionLandscape";

interface Props {
  params: Promise<{ id: string }>;
}

function parseWeekendId(id: string): { year: number; week: number } | null {
  const match = id.match(/^(\d{4})W(\d{1,2})$/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
}

export default async function WeekendPage({ params }: Props) {
  const { id } = await params;
  const parsed = parseWeekendId(id);
  if (!parsed) notFound();

  const { year, week } = parsed;
  const detail = getWeekendDetail(year, week);
  if (!detail) notFound();

  const vsAvgPct = ((detail.totalGross / detail.yearAvgGross) - 1) * 100;
  const allFilms = [...detail.openers, ...detail.holdovers].sort(
    (a, b) => (b.weekend_gross ?? 0) - (a.weekend_gross ?? 0)
  );

  const headingText = detail.marquee ?? detail.dateRange;
  const { grade, color: gradeColor } = scoreGrade(detail.score);

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Back */}
      <Link
        href={`/?year=${year}`}
        className="text-xs tracking-[0.2em] uppercase text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors inline-block mb-10"
      >
        ← {year} Calendar
      </Link>

      {/* Header */}
      <div className="mt-6">
        {detail.marquee && (
          <p className="text-xs tracking-[0.25em] uppercase text-[#b8860b] mb-2">
            {detail.dateRange}
          </p>
        )}
        <h1 className="font-serif font-bold text-4xl md:text-5xl text-[#0a0a0a] leading-tight">
          {headingText}
        </h1>
      </div>

      {/* Market + score summary */}
      <div className="mt-8 mb-6 border border-[#e5e5e5] p-6 bg-[#fafaf9]">
        <div className="flex items-start gap-8 flex-wrap">
          {/* Gross */}
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b] mb-1">Total Market</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-serif font-bold text-4xl text-[#0a0a0a] leading-none">
                {formatGross(detail.totalGross)}
              </span>
              <span className={`text-sm font-medium ${vsAvgPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {vsAvgPct >= 0 ? "↑" : "↓"} {Math.abs(vsAvgPct).toFixed(0)}% vs {year} avg
              </span>
            </div>
            <p className="text-xs text-[#6b6b6b] mt-1.5">
              {detail.filmCount} films · {detail.openers.length} new opener{detail.openers.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Slot score */}
          <div className="border-l border-[#e5e5e5] pl-8">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b] mb-1">Slot Score</p>
            <div className="flex items-baseline gap-2">
              <span className="font-serif font-bold text-4xl leading-none" style={{ color: gradeColor }}>
                {grade}
              </span>
              <span className="text-lg text-[#6b6b6b]">{detail.score}/100</span>
            </div>
            {/* Score breakdown */}
            <div className="flex gap-3 mt-2">
              <span className="text-[10px] text-[#9b9b9b]">
                Market +{detail.scoreBreakdown.marketScore}
              </span>
              <span className="text-[10px] text-[#9b9b9b]">
                Avail +{detail.scoreBreakdown.availabilityScore}
              </span>
              {detail.scoreBreakdown.holidayBonus > 0 && (
                <span className="text-[10px] text-[#b8860b]">
                  Holiday +{detail.scoreBreakdown.holidayBonus}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
          <Link
            href={`/compare?w1=${id}`}
            className="text-xs tracking-[0.2em] uppercase text-[#0a0a0a] hover:text-[#6b6b6b] transition-colors"
          >
            Compare this weekend →
          </Link>
        </div>
      </div>

      {/* Adjacent weekends */}
      {(detail.prevWeekend || detail.nextWeekend) && (
        <div className="flex gap-3 mb-10">
          {detail.prevWeekend && (() => {
            const { grade: pg, color: pc } = scoreGrade(detail.prevWeekend.score);
            return (
              <Link
                href={`/weekend/${detail.prevWeekend.id}`}
                className="flex-1 border border-[#e5e5e5] p-3 hover:bg-[#fafaf9] transition-colors"
              >
                <p className="text-[10px] uppercase tracking-wider text-[#9b9b9b] mb-1">← Previous</p>
                <p className="text-sm text-[#0a0a0a]">{detail.prevWeekend.dateLabel}</p>
                {detail.prevWeekend.marquee && (
                  <p className="text-[10px] text-[#b8860b]">{detail.prevWeekend.marquee}</p>
                )}
                <p className="text-xs text-[#6b6b6b] mt-0.5">{formatGross(detail.prevWeekend.totalGross)}</p>
                <p className="text-xs font-bold mt-1" style={{ color: pc }}>
                  {pg} ({detail.prevWeekend.score})
                </p>
              </Link>
            );
          })()}
          {detail.nextWeekend && (() => {
            const { grade: ng, color: nc } = scoreGrade(detail.nextWeekend.score);
            return (
              <Link
                href={`/weekend/${detail.nextWeekend.id}`}
                className="flex-1 border border-[#e5e5e5] p-3 hover:bg-[#fafaf9] transition-colors text-right"
              >
                <p className="text-[10px] uppercase tracking-wider text-[#9b9b9b] mb-1">Next →</p>
                <p className="text-sm text-[#0a0a0a]">{detail.nextWeekend.dateLabel}</p>
                {detail.nextWeekend.marquee && (
                  <p className="text-[10px] text-[#b8860b]">{detail.nextWeekend.marquee}</p>
                )}
                <p className="text-xs text-[#6b6b6b] mt-0.5">{formatGross(detail.nextWeekend.totalGross)}</p>
                <p className="text-xs font-bold mt-1" style={{ color: nc }}>
                  {ng} ({detail.nextWeekend.score})
                </p>
              </Link>
            );
          })()}
        </div>
      )}

      <CompetitionLandscape films={allFilms} totalGross={detail.totalGross} />
    </div>
  );
}
