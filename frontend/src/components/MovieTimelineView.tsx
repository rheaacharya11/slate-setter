"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FutureWeekendSummary, ReleaseWithWeek } from "@/lib/types";
import { formatGross } from "@/lib/format";
import { scoreGrade } from "@/lib/scoring";
import { inferGenre } from "@/lib/genres";
import type { Genre } from "@/lib/genres";

interface Props {
  weekends: FutureWeekendSummary[];
  releases: ReleaseWithWeek[];
  genreMode: boolean;
  genre: Genre | null;
  year: number;
}

const WEEK_W = 68;
const ROW_H = 26;
const HEADER_H = 44;
const WIDE_RUN = 6;
const LIMITED_RUN = 3;
const MAX_BAR_H = 20;
const MIN_BAR_H = 6;

function cleanTitle(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
}

function scoreBg(score: number): string {
  const t = score / 100;
  if (t >= 0.6) {
    const i = (t - 0.6) / 0.4;
    return `rgb(${Math.round(220 - i * 20)},${Math.round(240 - i * 10)},${Math.round(220 - i * 20)})`;
  }
  if (t >= 0.35) {
    const i = (t - 0.35) / 0.25;
    return `rgb(${Math.round(242 - i * 10)},${Math.round(242 - i * 20)},${Math.round(242 - i * 30)})`;
  }
  const i = (0.35 - t) / 0.35;
  return `rgb(242,${Math.round(242 - i * 60)},${Math.round(242 - i * 80)})`;
}

export default function MovieTimelineView({ weekends, releases, genreMode, genre, year: _year }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(weekends[0]?.id ?? null);
  const [genreFilter, setGenreFilter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const sorted = useMemo(
    () => [...weekends].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [weekends]
  );

  const weekIndex = useMemo(() => {
    const m = new Map<string, number>();
    sorted.forEach((w, i) => m.set(w.id, i));
    return m;
  }, [sorted]);

  const films = useMemo(() => {
    const byTitle = new Map<string, ReleaseWithWeek>();
    for (const r of releases) {
      const title = cleanTitle(r.film);
      const prev = byTitle.get(title);
      if (!prev || (r.isWide && !prev.isWide)) {
        byTitle.set(title, { ...r, film: title });
      }
    }
    return Array.from(byTitle.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [releases]);

  const maxGross = useMemo(
    () => Math.max(...sorted.map(w => w.historicalAvgGross), 1),
    [sorted]
  );

  const selIdx = selectedId ? (weekIndex.get(selectedId) ?? 0) : 0;
  const selWeekend = sorted[selIdx] ?? null;

  // Genre-filtered + selected-week-sorted view for the Gantt rows
  const displayFilms = useMemo(() => {
    const base = genreFilter && genre
      ? films.filter(f => (f.genre ?? inferGenre(f.film)) === genre)
      : films;
    return [...base].sort((a, b) => {
      const aOi = weekIndex.get(a.weekId) ?? 0;
      const bOi = weekIndex.get(b.weekId) ?? 0;
      const aRun = a.isWide ? WIDE_RUN : LIMITED_RUN;
      const bRun = b.isWide ? WIDE_RUN : LIMITED_RUN;
      const aOpens = a.weekId === selectedId;
      const bOpens = b.weekId === selectedId;
      if (aOpens !== bOpens) return aOpens ? -1 : 1;
      const aActive = selIdx >= aOi && selIdx < aOi + aRun;
      const bActive = selIdx >= bOi && selIdx < bOi + bRun;
      if (aActive !== bActive) return aActive ? -1 : 1;
      if (aActive && bActive) return aOi - bOi;
      return a.startDate.localeCompare(b.startDate);
    });
  }, [films, genreFilter, genre, selectedId, selIdx, weekIndex]);

  const pickWeekAtX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left + containerRef.current.scrollLeft;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(x / WEEK_W)));
    setSelectedId(sorted[idx]?.id ?? null);
  }, [sorted]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) pickWeekAtX(e.clientX);
  }, [pickWeekAtX]);

  const stopDrag = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [onMouseMove, stopDrag]);

  const totalW = sorted.length * WEEK_W;
  const timelineH = HEADER_H + displayFilms.length * ROW_H + 16;

  // Panel-level derived data
  const panelScore = selWeekend
    ? (genreMode ? (selWeekend.genreScore ?? selWeekend.score) : selWeekend.score)
    : 0;
  const { grade: panelGrade, color: panelColor } = selWeekend
    ? scoreGrade(panelScore)
    : { grade: "—", color: "#9b9b9b" };

  // Approximate score breakdown mirroring the scoreFutureWeekend formula in data.ts
  const overallAvg = useMemo(() => {
    const g = sorted.map(w => w.historicalAvgGross).filter(x => x > 0);
    return g.length ? g.reduce((a, b) => a + b, 0) / g.length : 1;
  }, [sorted]);

  // Per-year avg wideCount — mirrors the normalization applied server-side
  const yearAvgWideCount = useMemo(
    () => sorted.reduce((s, w) => s + w.wideCount, 0) / (sorted.length || 1),
    [sorted]
  );

  const approxBreakdown = useMemo(() => {
    if (!selWeekend) return null;
    const marketRatio = overallAvg > 0 ? selWeekend.historicalAvgGross / overallAvg : 0;
    const BASELINE = 2;
    const effectiveOpeners = yearAvgWideCount > 0
      ? selWeekend.wideCount * (BASELINE / Math.max(yearAvgWideCount, BASELINE))
      : selWeekend.wideCount;
    const holdoverEffective = selWeekend.holdoverEffective ?? 0;
    const takenShare = Math.min(1 - Math.pow(0.82, effectiveOpeners), 0.85);
    const availableShare = 1 - takenShare;
    return {
      marketPct: Math.round(Math.min(marketRatio * 50, 60)),
      availPct: Math.round(availableShare * 40),
      holiday: selWeekend.marquee ? 10 : 0,
      marketRatioStr: (Math.round(marketRatio * 100) / 100).toFixed(2),
      availPctRaw: Math.round(availableShare * 100),
      holdoverEffective,
    };
  }, [selWeekend, overallAvg, yearAvgWideCount]);

  const maxHistGross = useMemo(
    () => Math.max(...sorted.map(w => w.historicalAvgGross), 1),
    [sorted]
  );

  const openers = films.filter(f => f.weekId === selectedId);
  const holdovers = selWeekend
    ? films
        .filter(f => {
          const oi = weekIndex.get(f.weekId) ?? 0;
          const run = f.isWide ? WIDE_RUN : LIMITED_RUN;
          return f.weekId !== selectedId && selIdx >= oi && selIdx < oi + run;
        })
        .map(f => ({ ...f, weekInRun: selIdx - (weekIndex.get(f.weekId) ?? 0) + 1 }))
        .sort((a, b) => a.weekInRun - b.weekInRun)
    : [];

  return (
    <div className="flex gap-5 items-start">

      {/* ── Left: timeline ── */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-[#9b9b9b]">
          <div className="flex items-center gap-1.5">
            <div className="w-5 rounded-sm" style={{ height: 11, backgroundColor: "#1a1a1a" }} />
            <span>Wide</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 rounded-sm" style={{ height: 6, backgroundColor: "#9b9b9b" }} />
            <span>Limited</span>
          </div>
          <span className="text-[#d0d0d0]">·</span>
          <span>Bar height = market size · drag to scrub</span>
          {genre && (
            <button
              onClick={() => setGenreFilter(f => !f)}
              className={[
                "ml-2 px-2 py-0.5 border transition-colors",
                genreFilter
                  ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                  : "border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a]",
              ].join(" ")}
            >
              {genre} only
            </button>
          )}
        </div>

        {/* Scrollable canvas */}
        <div
          ref={containerRef}
          className="overflow-x-auto select-none"
          onMouseDown={e => { dragging.current = true; pickWeekAtX(e.clientX); }}
          style={{ cursor: "crosshair" }}
        >
          <div style={{ width: totalW, position: "relative", height: timelineH }}>

            {/* Column backgrounds + week headers */}
            {sorted.map((w, i) => {
              const colScore = genreMode ? (w.genreScore ?? w.score) : w.score;
              const isSel = w.id === selectedId;
              return (
                <div
                  key={w.id}
                  style={{
                    position: "absolute",
                    left: i * WEEK_W,
                    top: 0,
                    width: WEEK_W,
                    height: timelineH,
                    backgroundColor: isSel ? "rgba(0,0,0,0.06)" : scoreBg(colScore) + "55",
                    borderRight: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      height: HEADER_H,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      padding: "0 5px 5px",
                    }}
                  >
                    <span style={{
                      fontSize: 9,
                      letterSpacing: "0.05em",
                      color: isSel ? "#0a0a0a" : "#9b9b9b",
                      fontWeight: isSel ? 700 : 400,
                      display: "block",
                      lineHeight: 1,
                    }}>
                      {w.dateLabel}
                    </span>
                    {w.marquee && (
                      <span style={{ fontSize: 7, color: "#b8860b", display: "block", lineHeight: 1.2, marginTop: 2 }}>
                        {w.marquee}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Film bars */}
            {displayFilms.map((film, rowIdx) => {
              const openIdx = weekIndex.get(film.weekId) ?? 0;
              const run = film.isWide ? WIDE_RUN : LIMITED_RUN;
              const grossFrac = film.historicalAvgGross / maxGross;
              const barH = Math.round(
                MIN_BAR_H + grossFrac * (film.isWide ? MAX_BAR_H - MIN_BAR_H : (MAX_BAR_H - MIN_BAR_H) / 2)
              );
              const inSel = selIdx >= openIdx && selIdx < openIdx + run;
              const top = HEADER_H + rowIdx * ROW_H + (ROW_H - barH) / 2;
              return (
                <div
                  key={film.film + film.releaseDate}
                  title={film.film + (film.distributor ? ` · ${film.distributor}` : "")}
                  style={{
                    position: "absolute",
                    top,
                    left: openIdx * WEEK_W + 3,
                    width: run * WEEK_W - 6,
                    height: barH,
                    backgroundColor: film.isWide
                      ? inSel ? "#1a1a1a" : "#3a3a3a"
                      : inSel ? "#7a7a7a" : "#b0b0b0",
                    opacity: inSel ? 1 : 0.35,
                    transition: "opacity 0.1s, background-color 0.1s",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 5,
                    overflow: "hidden",
                    borderRadius: 1,
                  }}
                >
                  <span style={{ fontSize: 8, color: "#fff", whiteSpace: "nowrap", fontWeight: 500 }}>
                    {film.film}
                  </span>
                </div>
              );
            })}

            {/* Selected week border */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: selIdx * WEEK_W,
                width: WEEK_W,
                height: timelineH,
                border: "2px solid #0a0a0a",
                pointerEvents: "none",
                zIndex: 10,
                transition: "left 0.08s",
                boxSizing: "border-box",
              }}
            />

            {films.length === 0 && (
              <p style={{ position: "absolute", top: HEADER_H + 16, left: 8, fontSize: 13, color: "#9b9b9b" }}>
                No scheduled releases found.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: sticky side panel ── */}
      <div className="w-72 shrink-0 sticky top-6 border border-[#e5e5e5] bg-white">

        {/* Header */}
        <div className="px-4 py-3 border-b border-[#e5e5e5] bg-[#fafaf9]">
          {selWeekend ? (
            <>
              {selWeekend.marquee && (
                <p className="text-[9px] tracking-[0.2em] uppercase text-[#b8860b] mb-0.5">
                  {selWeekend.marquee}
                </p>
              )}
              <p className="text-sm font-medium text-[#0a0a0a] leading-snug">{selWeekend.dateRange}</p>
              {selWeekend.historicalAvgGross > 0 && (
                <p className="text-[10px] text-[#9b9b9b] mt-0.5">
                  Hist. avg {formatGross(selWeekend.historicalAvgGross)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#9b9b9b]">Drag to select a week</p>
          )}
        </div>

        {selWeekend && (
          <>
            {/* Historical avg gross mini-chart */}
            <div className="px-4 pt-2.5 pb-2 border-b border-[#e5e5e5]">
              <p className="text-[9px] uppercase tracking-wider text-[#9b9b9b] mb-1.5">
                Historical avg gross — all weekends
              </p>
              <svg width="100%" height="32" style={{ display: "block", overflow: "visible" }}>
                {sorted.map((w, i) => {
                  const barH = Math.max(2, Math.round((w.historicalAvgGross / maxHistGross) * 28));
                  const isSel = w.id === selectedId;
                  const pct = 100 / sorted.length;
                  return (
                    <rect
                      key={w.id}
                      x={`${i * pct + 0.15}%`}
                      y={32 - barH}
                      width={`${pct - 0.3}%`}
                      height={barH}
                      fill={isSel ? "#0a0a0a" : scoreBg(genreMode ? (w.genreScore ?? w.score) : w.score)}
                    />
                  );
                })}
              </svg>
              <div className="flex justify-between text-[8px] text-[#c0c0c0] mt-0.5">
                <span>{sorted[0]?.dateLabel}</span>
                <span className="text-[#6b6b6b]">↑ {formatGross(selWeekend.historicalAvgGross)} this wk</span>
                <span>{sorted[sorted.length - 1]?.dateLabel}</span>
              </div>
            </div>

            {/* Slot score */}
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-[9px] uppercase tracking-wider text-[#9b9b9b]">Slot score</p>
                <div className="relative group">
                  <button
                    className="w-3.5 h-3.5 rounded-full border border-[#d0d0d0] text-[#b0b0b0] text-[7px] leading-none flex items-center justify-center hover:border-[#6b6b6b] hover:text-[#6b6b6b] transition-colors"
                    tabIndex={-1}
                    aria-label="Score formula explanation"
                  >
                    ?
                  </button>
                  <div className="absolute left-0 top-5 z-50 hidden group-hover:block w-56 bg-white border border-[#e5e5e5] shadow-lg p-3 text-[10px] text-[#4b4b4b] leading-relaxed pointer-events-none">
                    <p className="font-medium text-[#0a0a0a] mb-1">How the score is computed</p>
                    <p className="text-[#6b6b6b] mb-2">Market strength × Availability + Holiday bonus</p>
                    {approxBreakdown && (
                      <div className="space-y-1.5 border-t border-[#f0f0f0] pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-[#6b6b6b]">Market ({approxBreakdown.marketRatioStr}× avg)</span>
                          <span className="tabular-nums font-medium shrink-0">{approxBreakdown.marketPct} pts</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#6b6b6b]">{approxBreakdown.availPctRaw}% avail. ({selWeekend.wideCount} wide + {approxBreakdown.holdoverEffective.toFixed(1)} holdover)</span>
                          <span className="tabular-nums font-medium shrink-0">{approxBreakdown.availPct} pts</span>
                        </div>
                        {approxBreakdown.holiday > 0 && (
                          <div className="flex justify-between gap-2">
                            <span className="text-[#6b6b6b]">Holiday ({selWeekend.marquee})</span>
                            <span className="tabular-nums font-medium shrink-0">+{approxBreakdown.holiday}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-2 border-t border-[#f0f0f0] pt-1.5 mt-0.5">
                          <span className="font-medium text-[#0a0a0a]">Total</span>
                          <span className="tabular-nums font-bold" style={{ color: panelColor }}>{panelScore}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif font-bold text-3xl leading-none" style={{ color: panelColor }}>
                  {panelGrade}
                </span>
                <span className="text-sm text-[#9b9b9b]">{panelScore} / 100</span>
              </div>
              {genreMode && selWeekend.genreThreatCount != null && (
                <p className="text-xs mt-1.5 font-medium" style={{
                  color: selWeekend.genreThreatCount > 0 ? "#b8860b" : "#16a34a",
                }}>
                  {selWeekend.genreThreatCount === 0
                    ? "✓ Clear genre field"
                    : `${selWeekend.genreThreatCount} same-genre film${selWeekend.genreThreatCount !== 1 ? "s" : ""}`}
                </p>
              )}
              <p className="text-[10px] text-[#9b9b9b] mt-1">
                {selWeekend.wideCount} wide release{selWeekend.wideCount !== 1 ? "s" : ""} scheduled
              </p>
            </div>

            {/* Competition */}
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[9px] uppercase tracking-wider text-[#9b9b9b] mb-2">Competition</p>

              {openers.length > 0 && (
                <div className="mb-2.5">
                  <p className="text-[8px] uppercase tracking-wider text-[#c0c0c0] mb-1">Opening same week</p>
                  <div className="space-y-1">
                    {openers.slice(0, 5).map(f => {
                      const isGenreMatch = genre != null && (f.genre ?? inferGenre(f.film)) === genre;
                      return (
                        <div key={f.film + f.releaseDate} className="flex items-center gap-1.5">
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                            backgroundColor: f.isWide ? "#0a0a0a" : "#c0c0c0",
                            display: "inline-block",
                          }} />
                          {isGenreMatch && (
                            <span className="text-[8px] px-1 shrink-0 leading-tight" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                              {genre}
                            </span>
                          )}
                          <a
                            href={`https://www.imdb.com/find/?q=${encodeURIComponent(f.film)}&s=tt&ttype=ft`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] truncate hover:underline"
                            style={{ color: isGenreMatch ? "#0a0a0a" : "#0a0a0a", fontWeight: isGenreMatch ? 600 : 400 }}
                          >
                            {f.film}
                          </a>
                        </div>
                      );
                    })}
                    {openers.length > 5 && (
                      <p className="text-[10px] text-[#9b9b9b]">+{openers.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {holdovers.length > 0 && (
                <div>
                  <p className="text-[8px] uppercase tracking-wider text-[#c0c0c0] mb-1">Holding over</p>
                  <div className="space-y-1">
                    {holdovers.slice(0, 7).map(f => {
                      const isGenreMatch = genre != null && (f.genre ?? inferGenre(f.film)) === genre;
                      return (
                        <div key={f.film + f.releaseDate} className="flex items-center gap-1.5">
                          <span className="text-[9px] tabular-nums shrink-0 px-1 leading-tight" style={{
                            backgroundColor: f.weekInRun <= 2 ? "#f5f0e8" : "#f5f5f5",
                            color: f.weekInRun <= 2 ? "#b8860b" : "#9b9b9b",
                          }}>
                            wk{f.weekInRun}
                          </span>
                          {isGenreMatch && (
                            <span className="text-[8px] px-1 shrink-0 leading-tight" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                              {genre}
                            </span>
                          )}
                          <a
                            href={`https://www.imdb.com/find/?q=${encodeURIComponent(f.film)}&s=tt&ttype=ft`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] truncate hover:underline"
                            style={{ color: f.weekInRun <= 2 ? "#0a0a0a" : "#9b9b9b", fontWeight: isGenreMatch ? 600 : 400 }}
                          >
                            {f.film}
                          </a>
                        </div>
                      );
                    })}
                    {holdovers.length > 7 && (
                      <p className="text-[10px] text-[#9b9b9b]">+{holdovers.length - 7} more</p>
                    )}
                  </div>
                </div>
              )}

              {openers.length === 0 && holdovers.length === 0 && (
                <p className="text-xs text-emerald-600">No scheduled competition.</p>
              )}
            </div>

            {/* Swap comparison */}
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[9px] uppercase tracking-wider text-[#9b9b9b] mb-2">What if I swap to…</p>
              <div className="space-y-1.5">
                {[-2, -1, 1, 2].map(offset => {
                  const idx = selIdx + offset;
                  if (idx < 0 || idx >= sorted.length) return null;
                  const w = sorted[idx];
                  const ws = genreMode ? (w.genreScore ?? w.score) : w.score;
                  const { grade: wg, color: wc } = scoreGrade(ws);
                  const delta = ws - panelScore;
                  const deltaStr = delta > 0 ? `+${delta}` : String(delta);
                  const deltaColor = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#9b9b9b";
                  const wOpeners = films.filter(f => f.weekId === w.id);
                  const wHoldovers = films.filter(f => {
                    const oi = weekIndex.get(f.weekId) ?? 0;
                    const run = f.isWide ? WIDE_RUN : LIMITED_RUN;
                    return f.weekId !== w.id && idx >= oi && idx < oi + run;
                  });
                  return (
                    <button
                      key={w.id}
                      onClick={() => setSelectedId(w.id)}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-2 border border-[#e5e5e5] hover:border-[#0a0a0a] transition-colors"
                    >
                      <span className="text-[9px] text-[#9b9b9b] shrink-0 w-8 tabular-nums">
                        {offset < 0 ? `−${Math.abs(offset)}wk` : `+${offset}wk`}
                      </span>
                      <span className="text-[11px] text-[#6b6b6b] flex-1 truncate">{w.dateLabel}</span>
                      <span className="font-bold text-xs shrink-0" style={{ color: wc }}>{wg}</span>
                      <span className="text-[10px] tabular-nums shrink-0 w-7 text-right" style={{ color: deltaColor }}>
                        {deltaStr}
                      </span>
                      <span className="text-[9px] text-[#9b9b9b] shrink-0">
                        {wOpeners.length + wHoldovers.length}f
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deep compare link */}
            <div className="px-4 py-3">
              <button
                onClick={() => router.push(`/compare?mode=upcoming&w1=${selWeekend.id}`)}
                className="w-full text-center text-[10px] tracking-wider uppercase text-[#6b6b6b] hover:text-[#0a0a0a] border border-[#e5e5e5] hover:border-[#0a0a0a] py-2 transition-colors"
              >
                Deep compare →
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
