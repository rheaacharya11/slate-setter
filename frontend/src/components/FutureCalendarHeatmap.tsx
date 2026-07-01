"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FutureWeekendSummary } from "@/lib/types";
import { formatGross, getWeekendStartDate } from "@/lib/format";
import { scoreGrade } from "@/lib/scoring";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Props {
  data: FutureWeekendSummary[];
  genreMode: boolean;
}

function scoreCellBg(score: number): string {
  const t = score / 100;
  if (t >= 0.6) {
    const intensity = (t - 0.6) / 0.4;
    return `rgb(${Math.round(220 - intensity * 20)},${Math.round(240 - intensity * 10)},${Math.round(220 - intensity * 20)})`;
  }
  if (t >= 0.35) {
    const intensity = (t - 0.35) / 0.25;
    return `rgb(${Math.round(242 - intensity * 10)},${Math.round(242 - intensity * 20)},${Math.round(242 - intensity * 30)})`;
  }
  const intensity = (0.35 - t) / 0.35;
  return `rgb(242,${Math.round(242 - intensity * 60)},${Math.round(242 - intensity * 80)})`;
}

function textColor(bg: string): string {
  const m = bg.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return "#0a0a0a";
  const luma = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
  return luma < 128 ? "#ffffff" : "#0a0a0a";
}

export default function FutureCalendarHeatmap({ data, genreMode }: Props) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const monthGroups = useMemo(() => {
    const groups = new Map<number, FutureWeekendSummary[]>();
    for (let m = 0; m < 12; m++) groups.set(m, []);
    for (const s of data) {
      const date = getWeekendStartDate(s.year, s.week);
      groups.get(date.getMonth())!.push(s);
    }
    return Array.from(groups.entries())
      .map(([month, weeks]) => ({ month, label: MONTH_LABELS[month], weeks: weeks.sort((a, b) => a.week - b.week) }))
      .filter(g => g.weeks.length > 0);
  }, [data]);

  const hoveredSummary = data.find(d => d.id === hoveredId) ?? null;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {monthGroups.map(({ month, label, weeks }) => (
            <div key={month} className="flex flex-col gap-1.5">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b] text-center block mb-1">{label}</span>
              {weeks.map((summary) => {
                const displayScore = genreMode
                  ? (summary.genreScore ?? summary.score)
                  : summary.score;
                const bg = scoreCellBg(displayScore);
                const fg = textColor(bg);
                const { grade, color: gradeColor } = scoreGrade(displayScore);
                const isHovered = hoveredId === summary.id;
                const threatCount = summary.genreThreatCount ?? 0;

                return (
                  <button
                    key={summary.id}
                    onClick={() => router.push(`/compare?mode=upcoming&w1=${summary.id}`)}
                    onMouseEnter={() => setHoveredId(summary.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={[
                      "w-[88px] h-[58px] flex flex-col justify-between p-2 text-left transition-transform relative",
                      isHovered ? "scale-105 z-10 shadow-sm" : "",
                    ].join(" ")}
                    style={{
                      backgroundColor: bg,
                      border: summary.marquee ? "2px solid #b8860b" : "1px solid transparent",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold leading-none" style={{ color: gradeColor }}>{grade}</span>
                      {genreMode && threatCount > 0 && (
                        <span className="text-[8px] leading-none px-1 py-0.5" style={{ backgroundColor: "#b8860b", color: "#fff" }}>
                          {threatCount}⚠
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-medium leading-none block" style={{ color: fg }}>{summary.dateLabel}</span>
                      {summary.marquee ? (
                        <span className="text-[9px] leading-none mt-0.5 truncate block" style={{ color: "#b8860b" }}>{summary.marquee}</span>
                      ) : (
                        <span className="text-[9px] leading-none mt-0.5 block" style={{ color: fg, opacity: 0.7 }}>
                          {summary.wideCount} wide
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover detail */}
      <div
        className={["mt-3 border border-[#e5e5e5] transition-opacity", hoveredSummary ? "opacity-100" : "opacity-0 pointer-events-none"].join(" ")}
        style={{ minHeight: 80 }}
      >
        {hoveredSummary && (
          <div className="flex items-start gap-10 p-4">
            <div>
              {hoveredSummary.marquee && (
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#b8860b] mb-0.5">{hoveredSummary.marquee}</p>
              )}
              <p className="text-xs text-[#6b6b6b]">{hoveredSummary.dateRange}</p>
              <p className="font-serif font-bold text-3xl text-[#0a0a0a] mt-1.5 leading-none">
                {hoveredSummary.wideCount} wide release{hoveredSummary.wideCount !== 1 ? "s" : ""}
              </p>
              {hoveredSummary.historicalAvgGross > 0 && (
                <p className="text-xs text-[#9b9b9b] mt-1">
                  historically avg {formatGross(hoveredSummary.historicalAvgGross)} this time of year
                </p>
              )}
            </div>
            <div className="border-l border-[#e5e5e5] pl-8 self-stretch flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-wider text-[#9b9b9b] mb-1">Opportunity Score</p>
              {(() => {
                const activeScore = genreMode
                  ? (hoveredSummary.genreScore ?? hoveredSummary.score)
                  : hoveredSummary.score;
                return (
                  <p className="font-serif font-bold text-2xl leading-none" style={{ color: scoreGrade(activeScore).color }}>
                    {scoreGrade(activeScore).grade}
                    <span className="text-sm font-normal text-[#9b9b9b] ml-2">({activeScore}/100)</span>
                  </p>
                );
              })()}
              {genreMode && (
                <p className="text-xs mt-1" style={{ color: (hoveredSummary.genreThreatCount ?? 0) > 0 ? "#b8860b" : "#16a34a" }}>
                  {(hoveredSummary.genreThreatCount ?? 0) === 0
                    ? "Clear field — no genre competition"
                    : `${hoveredSummary.genreThreatCount} genre threat${hoveredSummary.genreThreatCount !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>
            <div className="ml-auto self-end text-xs text-[#c0c0c0]">click to compare →</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap text-[10px] uppercase tracking-wider text-[#9b9b9b]">
        <div className="flex items-center gap-1.5"><div className="w-4 h-3" style={{ backgroundColor: scoreCellBg(85) }} /><span>High opportunity</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-3" style={{ backgroundColor: scoreCellBg(45) }} /><span>Medium</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-3" style={{ backgroundColor: scoreCellBg(15) }} /><span>Low (crowded)</span></div>
        <div className="flex items-center gap-1.5 ml-4"><div className="w-5 h-3 border-2 border-[#b8860b]" style={{ backgroundColor: "#f5f0e8" }} /><span>Holiday</span></div>
        {genreMode && (
          <div className="flex items-center gap-1.5 ml-4">
            <span className="px-1 text-[8px]" style={{ backgroundColor: "#b8860b", color: "#fff" }}>N⚠</span>
            <span>Genre threats</span>
          </div>
        )}
      </div>
    </div>
  );
}
