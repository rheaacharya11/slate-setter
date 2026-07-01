import type { WeekendSummary } from "@/lib/types";
import { formatGross } from "@/lib/format";

interface Props {
  summary: WeekendSummary;
}

export default function WeekendCard({ summary }: Props) {
  return (
    <a
      href={`/weekend/${summary.id}`}
      className="block border-b border-[#e5e5e5] py-5 hover:bg-[#fafaf9] transition-colors group"
    >
      {/* Top row: date + marquee badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs tracking-[0.2em] uppercase text-[#6b6b6b]">
          {summary.dateLabel}
        </span>
        {summary.marquee && (
          <span className="text-xs tracking-[0.15em] uppercase text-[#b8860b] text-right leading-snug">
            {summary.marquee}
          </span>
        )}
      </div>

      {/* Middle: total gross */}
      <p className="font-serif font-bold text-2xl text-[#0a0a0a] mt-2 leading-none">
        {formatGross(summary.totalGross)}
      </p>

      {/* Bottom: top film + film count */}
      <div className="flex items-end justify-between gap-2 mt-2">
        <p className="text-sm text-[#0a0a0a] leading-snug line-clamp-1 group-hover:text-[#0a0a0a]">
          {summary.topFilm}
        </p>
        <p className="text-xs text-[#6b6b6b] whitespace-nowrap shrink-0">
          {summary.filmCount} films
        </p>
      </div>
    </a>
  );
}
