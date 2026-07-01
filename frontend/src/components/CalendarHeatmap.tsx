"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WeekendSummary } from "@/lib/types";
import { formatGross, getWeekendStartDate } from "@/lib/format";
import { scoreGrade } from "@/lib/scoring";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Props {
  data: WeekendSummary[];
  genreMode: boolean; // true when a genre is selected → color by score instead of gross
}

export default function CalendarHeatmap({ data, genreMode }: Props) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Gross-based color scale (no genre)
  const maxGross = useMemo(() => Math.max(...data.map((d) => d.totalGross), 1), [data]);
  const minGross = useMemo(() => Math.min(...data.map((d) => d.totalGross), 0), [data]);

  const monthGroups = useMemo(() => {
    const groups = new Map<number, WeekendSummary[]>();
    for (let m = 0; m < 12; m++) groups.set(m, []);
    for (const s of data) {
      const date = getWeekendStartDate(s.year, s.week);
      const m = date.getMonth();
      groups.get(m)!.push(s);
    }
    return Array.from(groups.entries())
      .map(([month, weeks]) => ({
        month,
        label: MONTH_LABELS[month],
        weeks: weeks.sort((a, b) => a.week - b.week),
      }))
      .filter((g) => g.weeks.length > 0);
  }, [data]);

  function grossCellBg(gross: number): string {
    const range = maxGross - minGross;
    const t = range > 0 ? (gross - minGross) / range : 0.5;
    const r = Math.round(242 + (12 - 242) * t);
    const g = Math.round(238 + (12 - 238) * t);
    const b = Math.round(233 + (12 - 233) * t);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Score-based cell color in genre mode.
   * High score (70–100) → green tint
   * Medium score (40–70) → neutral
   * Low score (0–40)    → warm red tint
   */
  function scoreCellBg(score: number): string {
    const t = score / 100;
    if (t >= 0.7) {
      // 70-100: white → green
      const g_val = Math.round(255 - (255 - 220) * ((t - 0.7) / 0.3));
      return `rgb(${Math.round(230 + (200 - 230) * ((t - 0.7) / 0.3))},${g_val},${Math.round(230 + (200 - 230) * ((t - 0.7) / 0.3))})`;
    }
    if (t >= 0.4) {
      // 40-70: off-white
      const v = Math.round(242 - (t - 0.4) / 0.3 * 20);
      return `rgb(${v},${v},${v})`;
    }
    // 0-40: white → red tint
    const intensity = (0.4 - t) / 0.4;
    return `rgb(${Math.round(242)},${Math.round(242 - intensity * 60)},${Math.round(242 - intensity * 80)})`;
  }

  function textColor(bg: string): string {
    const m = bg.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!m) return "#0a0a0a";
    const luma = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
    return luma < 128 ? "#ffffff" : "#0a0a0a";
  }

  const hoveredSummary = data.find((d) => d.id === hoveredId) ?? null;
  const activeScore = genreMode
    ? (hoveredSummary?.genreScore ?? hoveredSummary?.score)
    : hoveredSummary?.score;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {monthGroups.map(({ month, label, weeks }) => (
            <div key={month} className="flex flex-col gap-1.5">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b] text-center block mb-1">
                {label}
              </span>
              {weeks.map((summary) => {
                const displayScore = genreMode
                  ? (summary.genreScore ?? summary.score)
                  : summary.score;
                const bg = genreMode
                  ? scoreCellBg(displayScore)
                  : grossCellBg(summary.totalGross);
                const fg = textColor(bg);
                const { grade, color: gradeColor } = scoreGrade(displayScore);
                const isHovered = hoveredId === summary.id;
                const hasThreat = genreMode && (summary.genreThreatCount ?? 0) > 0;

                return (
                  <button
                    key={summary.id}
                    onClick={() => router.push(`/weekend/${summary.id}`)}
                    onMouseEnter={() => setHoveredId(summary.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={[
                      "w-[88px] h-[58px] flex flex-col justify-between p-2 text-left transition-transform relative",
                      isHovered ? "scale-105 z-10 shadow-sm" : "",
                    ].join(" ")}
                    style={{
                      backgroundColor: bg,
                      border: summary.marquee
                        ? "2px solid #b8860b"
                        : "1px solid transparent",
                    }}
                  >
                    {/* Top row: score grade */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold leading-none"
                        style={{ color: gradeColor }}
                      >
                        {grade}
                      </span>
                      {/* Genre threat badge */}
                      {hasThreat && (
                        <span
                          className="text-[8px] leading-none px-1 py-0.5 rounded-sm"
                          style={{ backgroundColor: "#b8860b", color: "#fff" }}
                        >
                          {summary.genreThreatCount}⚠
                        </span>
                      )}
                    </div>

                    {/* Bottom: date + value */}
                    <div>
                      <span
                        className="text-[11px] font-medium leading-none block"
                        style={{ color: fg }}
                      >
                        {summary.dateLabel}
                      </span>
                      {summary.marquee ? (
                        <span
                          className="text-[9px] leading-none mt-0.5 truncate block"
                          style={{ color: "#b8860b" }}
                        >
                          {summary.marquee}
                        </span>
                      ) : genreMode ? (
                        <span
                          className="text-[9px] leading-none mt-0.5 block"
                          style={{ color: fg, opacity: 0.7 }}
                        >
                          {displayScore}/100
                        </span>
                      ) : (
                        <span
                          className="text-[9px] leading-none mt-0.5 block"
                          style={{ color: fg, opacity: 0.65 }}
                        >
                          {formatGross(summary.totalGross)}
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

      {/* Hover detail panel */}
      <div
        className={[
          "mt-3 border border-[#e5e5e5] transition-opacity",
          hoveredSummary ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        style={{ minHeight: 80 }}
      >
        {hoveredSummary && (
          <div className="flex items-start gap-10 p-4">
            <div>
              {hoveredSummary.marquee && (
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#b8860b] mb-0.5">
                  {hoveredSummary.marquee}
                </p>
              )}
              <p className="text-xs text-[#6b6b6b]">{hoveredSummary.dateRange}</p>
              <p className="font-serif font-bold text-3xl text-[#0a0a0a] mt-1.5 leading-none">
                {formatGross(hoveredSummary.totalGross)}
              </p>
            </div>
            <div className="border-l border-[#e5e5e5] pl-8 self-stretch flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-wider text-[#9b9b9b] mb-1">Slot Score</p>
              {activeScore != null && (
                <p
                  className="font-serif font-bold text-2xl leading-none"
                  style={{ color: scoreGrade(activeScore).color }}
                >
                  {activeScore}
                  <span className="text-sm font-normal text-[#9b9b9b] ml-1">/100</span>
                </p>
              )}
              {genreMode && hoveredSummary.genreThreatCount != null && (
                <p className="text-xs text-[#b8860b] mt-1">
                  {hoveredSummary.genreThreatCount === 0
                    ? "Clear field — no genre competition"
                    : `${hoveredSummary.genreThreatCount} genre threat${hoveredSummary.genreThreatCount > 1 ? "s" : ""}`}
                </p>
              )}
            </div>
            <div className="border-l border-[#e5e5e5] pl-8 self-stretch flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-wider text-[#9b9b9b] mb-1">Top film</p>
              <p className="text-sm font-medium text-[#0a0a0a]">{hoveredSummary.topFilm}</p>
              <p className="text-xs text-[#9b9b9b] mt-1">{hoveredSummary.filmCount} films in release</p>
            </div>
            <div className="ml-auto self-end text-xs text-[#c0c0c0]">click to open →</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap text-[10px] uppercase tracking-wider text-[#9b9b9b]">
        {genreMode ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3" style={{ backgroundColor: "rgb(200,230,200)" }} />
              <span>High score</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3" style={{ backgroundColor: "rgb(242,182,162)" }} />
              <span>Low score</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1 text-[8px]" style={{ backgroundColor: "#b8860b", color: "#fff" }}>N⚠</span>
              <span>Genre threats</span>
            </div>
          </>
        ) : (
          <>
            <span>Lower gross</span>
            <div className="flex gap-px">
              {[0.05, 0.25, 0.5, 0.75, 0.95].map((t) => {
                const r = Math.round(242 + (12 - 242) * t);
                const g = Math.round(238 + (12 - 238) * t);
                const b = Math.round(233 + (12 - 233) * t);
                return <div key={t} className="w-6 h-3" style={{ backgroundColor: `rgb(${r},${g},${b})` }} />;
              })}
            </div>
            <span>Higher gross</span>
            <div className="flex items-center gap-1.5 ml-4">
              <div className="w-5 h-3 border-2 border-[#b8860b]" style={{ backgroundColor: "#f5f0e8" }} />
              <span>Holiday</span>
            </div>
          </>
        )}
        <div className="ml-4 flex items-center gap-3">
          {(["High","Medium","Low"] as const).map((g) => {
            const colors: Record<string,string> = { High: "#16a34a", Medium: "#ca8a04", Low: "#dc2626" };
            return <span key={g} className="font-bold" style={{ color: colors[g] }}>{g}</span>;
          })}
          <span>= slot grade</span>
        </div>
      </div>
    </div>
  );
}
