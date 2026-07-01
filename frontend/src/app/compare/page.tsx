"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { WeekendSummary, WeekendDetail, FilmRecord, FutureWeekendSummary, FutureWeekendDetail, ScheduledRelease } from "@/lib/types";
import { formatGross } from "@/lib/format";
import { ALL_GENRES } from "@/lib/genres";
import { inferGenre } from "@/lib/genres";
import type { Genre } from "@/lib/genres";
import { scoreGrade } from "@/lib/scoring";

// ─── Mode toggle ─────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: "upcoming" | "historical"; onChange: (m: "upcoming" | "historical") => void }) {
  return (
    <div className="inline-flex border border-[#e5e5e5]">
      {(["upcoming", "historical"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={[
            "text-xs px-4 py-2 tracking-[0.15em] uppercase transition-colors",
            mode === m
              ? "bg-[#0a0a0a] text-white"
              : "bg-white text-[#6b6b6b] hover:text-[#0a0a0a]",
          ].join(" ")}
        >
          {m === "upcoming" ? "Upcoming" : "Historical"}
        </button>
      ))}
    </div>
  );
}

// ─── Historical weekend picker ────────────────────────────────────────────────

function HistoricalPicker({ label, selectedId, onSelect }: { label: "A" | "B"; selectedId: string; onSelect: (id: string) => void }) {
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [weekends, setWeekends] = useState<WeekendSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/weekends?year=2024")
      .then((r) => r.json())
      .then((data: { summaries: WeekendSummary[]; availableYears: number[] }) => {
        setYears(data.availableYears);
        setWeekends(data.summaries);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/weekends?year=${selectedYear}`)
      .then((r) => r.json())
      .then((data: { summaries: WeekendSummary[] }) => setWeekends(data.summaries))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] tracking-[0.25em] uppercase text-[#9b9b9b] mb-3">Weekend {label}</p>
      <div className="flex gap-2 flex-wrap">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="text-sm border border-[#e5e5e5] px-3 py-2 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          disabled={loading}
          className="text-sm border border-[#e5e5e5] px-3 py-2 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors flex-1 min-w-[220px] disabled:opacity-50"
        >
          <option value="">Select a weekend…</option>
          {weekends.map((w) => (
            <option key={w.id} value={w.id}>
              {w.dateRange}{w.marquee ? ` — ${w.marquee}` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Upcoming weekend picker ──────────────────────────────────────────────────

function UpcomingPicker({ label, selectedId, onSelect, weekends }: {
  label: "A" | "B";
  selectedId: string;
  onSelect: (id: string) => void;
  weekends: FutureWeekendSummary[];
}) {
  const years = Array.from(new Set(weekends.map(w => w.year))).sort();
  const [selectedYear, setSelectedYear] = useState<number>(years[0] ?? new Date().getFullYear());
  const filtered = weekends.filter(w => w.year === selectedYear);

  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) setSelectedYear(years[0]);
  }, [years, selectedYear]);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] tracking-[0.25em] uppercase text-[#9b9b9b] mb-3">Weekend {label}</p>
      <div className="flex gap-2 flex-wrap">
        <select
          value={selectedYear}
          onChange={(e) => { setSelectedYear(Number(e.target.value)); onSelect(""); }}
          className="text-sm border border-[#e5e5e5] px-3 py-2 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="text-sm border border-[#e5e5e5] px-3 py-2 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors flex-1 min-w-[220px]"
        >
          <option value="">Select a weekend…</option>
          {filtered.map((w) => (
            <option key={w.id} value={w.id}>
              {w.dateRange}{w.marquee ? ` — ${w.marquee}` : ""} ({w.wideCount} wide)
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Verdict stat card ────────────────────────────────────────────────────────

function VerdictCard({ label, valueA, valueB, winnerA, winnerNote }: {
  label: string;
  valueA: React.ReactNode;
  valueB: React.ReactNode;
  winnerA: boolean | null;
  winnerNote?: string;
}) {
  return (
    <div className="border border-[#e5e5e5] p-5">
      <p className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b] mb-4">{label}</p>
      <div className="flex gap-5">
        <div className={`flex-1 ${winnerA === false ? "opacity-35" : ""}`}>
          <p className="text-[10px] text-[#9b9b9b] mb-1">A</p>
          <div className="font-serif font-bold text-xl text-[#0a0a0a] leading-none">{valueA}</div>
          {winnerA === true && winnerNote && <p className="text-[10px] text-emerald-600 mt-1.5">{winnerNote}</p>}
        </div>
        <div className={`flex-1 ${winnerA === true ? "opacity-35" : ""}`}>
          <p className="text-[10px] text-[#9b9b9b] mb-1">B</p>
          <div className="font-serif font-bold text-xl text-[#0a0a0a] leading-none">{valueB}</div>
          {winnerA === false && winnerNote && <p className="text-[10px] text-emerald-600 mt-1.5">{winnerNote}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Historical film row ──────────────────────────────────────────────────────

function HistoricalFilmRow({ film, rank, maxGross, myGenre }: {
  film: FilmRecord; rank: number; maxGross: number; myGenre: Genre | null;
}) {
  const gross = film.weekend_gross ?? 0;
  const barWidth = maxGross > 0 ? (gross / maxGross) * 100 : 0;
  const isDirectThreat = myGenre !== null && film.genre === myGenre;
  const isDimmed = myGenre !== null && film.genre !== myGenre;

  return (
    <div className={`py-2.5 border-b border-[#f0f0f0] transition-opacity ${isDimmed ? "opacity-25" : ""}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-[#c0c0c0] w-5 shrink-0 tabular-nums">{rank}</span>
        <span className="flex-1 text-sm font-medium text-[#0a0a0a] truncate min-w-0">{film.film}</span>
        {film.is_new_release
          ? <span className="text-[9px] tracking-wider px-1.5 py-0.5 bg-[#0a0a0a] text-white uppercase shrink-0">New</span>
          : <span className="text-[9px] tracking-wider px-1.5 py-0.5 bg-[#f0f0f0] text-[#6b6b6b] uppercase shrink-0">Wk {film.week_number_in_release ?? "?"}</span>}
        {film.genre && (
          <span className={["text-[9px] px-1.5 py-0.5 uppercase tracking-wider shrink-0", isDirectThreat ? "bg-[#b8860b] text-white" : "text-[#b0b0b0]"].join(" ")}>
            {film.genre}
          </span>
        )}
        <span className="font-serif font-bold text-sm text-[#0a0a0a] shrink-0 w-14 text-right tabular-nums">{formatGross(gross)}</span>
      </div>
      <div className="ml-7 h-1 bg-[#f0f0f0]">
        <div className={isDirectThreat ? "bg-[#b8860b]" : film.is_new_release ? "bg-[#0a0a0a]" : "bg-[#b8b8b8]"} style={{ width: `${barWidth}%`, height: "100%" }} />
      </div>
    </div>
  );
}

// ─── Scheduled release row (future) ──────────────────────────────────────────

function ScheduledRow({ release, myGenre }: { release: ScheduledRelease; myGenre: Genre | null }) {
  const cleanTitle = release.film.replace(/\s*\((Wide|Limited|IMAX|Special Engagement|re-release)[^)]*\)\s*/gi, "").trim();
  const genre = inferGenre(cleanTitle);
  const isDirectThreat = myGenre !== null && genre === myGenre;
  const isDimmed = myGenre !== null && genre !== myGenre;

  return (
    <div className={`py-2.5 border-b border-[#f0f0f0] transition-opacity ${isDimmed ? "opacity-25" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium text-[#0a0a0a] truncate min-w-0">{cleanTitle}</span>
        {release.isWide
          ? <span className="text-[9px] tracking-wider px-1.5 py-0.5 bg-[#0a0a0a] text-white uppercase shrink-0">Wide</span>
          : <span className="text-[9px] tracking-wider px-1.5 py-0.5 bg-[#f0f0f0] text-[#6b6b6b] uppercase shrink-0">Limited</span>}
        {genre && (
          <span className={["text-[9px] px-1.5 py-0.5 uppercase tracking-wider shrink-0", isDirectThreat ? "bg-[#b8860b] text-white" : "text-[#b0b0b0]"].join(" ")}>
            {genre}
          </span>
        )}
        {release.distributor && (
          <span className="text-[10px] text-[#9b9b9b] shrink-0 max-w-[100px] truncate">{release.distributor}</span>
        )}
      </div>
    </div>
  );
}

// ─── Upcoming compare results ─────────────────────────────────────────────────

function UpcomingResults({ a, b, myGenre }: { a: FutureWeekendDetail; b: FutureWeekendDetail; myGenre: Genre | null }) {
  const { grade: ga, color: ca } = scoreGrade(a.score);
  const { grade: gb, color: cb } = scoreGrade(b.score);

  const aWide = a.scheduledReleases.filter(r => r.isWide);
  const bWide = b.scheduledReleases.filter(r => r.isWide);

  const aGenreThreats = myGenre ? a.scheduledReleases.filter(r => {
    const t = r.film.replace(/\s*\([^)]*\)\s*/gi, "").trim();
    return (r.genre ?? inferGenre(t)) === myGenre;
  }).length : null;
  const bGenreThreats = myGenre ? b.scheduledReleases.filter(r => {
    const t = r.film.replace(/\s*\([^)]*\)\s*/gi, "").trim();
    return (r.genre ?? inferGenre(t)) === myGenre;
  }).length : null;

  return (
    <div>
      {myGenre && aGenreThreats !== null && bGenreThreats !== null && (
        <div className="mb-8 pb-8 border-b border-[#e5e5e5]">
          <p className="text-xs text-[#b8860b]">
            {myGenre} competition: <strong>{aGenreThreats}</strong> film{aGenreThreats !== 1 ? "s" : ""} on Weekend A
            {" · "}
            <strong>{bGenreThreats}</strong> film{bGenreThreats !== 1 ? "s" : ""} on Weekend B
            {aGenreThreats !== bGenreThreats && (
              <span className="text-emerald-600 ml-2">
                → Weekend {aGenreThreats < bGenreThreats ? "A" : "B"} has less {myGenre} competition
              </span>
            )}
          </p>
        </div>
      )}

      {/* Verdict cards */}
      <div className={`grid gap-3 mb-12 ${myGenre ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"}`}>
        <VerdictCard
          label="Slot Score"
          valueA={<span style={{ color: ca }}>{ga} <span className="text-sm font-normal text-[#9b9b9b]">({a.score})</span></span>}
          valueB={<span style={{ color: cb }}>{gb} <span className="text-sm font-normal text-[#9b9b9b]">({b.score})</span></span>}
          winnerA={a.score === b.score ? null : a.score > b.score}
          winnerNote="↑ Better slot"
        />
        <VerdictCard
          label="Wide Openers"
          valueA={String(aWide.length)}
          valueB={String(bWide.length)}
          winnerA={aWide.length === bWide.length ? null : aWide.length < bWide.length}
          winnerNote="↓ Less crowded"
        />
        <VerdictCard
          label="Hist. Avg Market"
          valueA={a.historicalAvgGross > 0 ? formatGross(a.historicalAvgGross) : "—"}
          valueB={b.historicalAvgGross > 0 ? formatGross(b.historicalAvgGross) : "—"}
          winnerA={a.historicalAvgGross === b.historicalAvgGross ? null : a.historicalAvgGross > b.historicalAvgGross}
          winnerNote="↑ Larger historical market"
        />
        <VerdictCard
          label="Holiday"
          valueA={<span className={a.marquee ? "text-[#b8860b] text-base" : "text-[#c0c0c0] text-base"}>{a.marquee ?? "None"}</span>}
          valueB={<span className={b.marquee ? "text-[#b8860b] text-base" : "text-[#c0c0c0] text-base"}>{b.marquee ?? "None"}</span>}
          winnerA={a.marquee && !b.marquee ? true : !a.marquee && b.marquee ? false : null}
          winnerNote="↑ Built-in event demand"
        />
        {myGenre && aGenreThreats !== null && bGenreThreats !== null && (
          <VerdictCard
            label={`${myGenre} Threats`}
            valueA={String(aGenreThreats)}
            valueB={String(bGenreThreats)}
            winnerA={aGenreThreats === bGenreThreats ? null : aGenreThreats < bGenreThreats}
            winnerNote="↓ Fewer genre rivals"
          />
        )}
      </div>

      {/* Side-by-side scheduled releases */}
      <p className="text-xs tracking-[0.25em] uppercase text-[#6b6b6b] mb-6">Confirmed Competition</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {[{ detail: a, side: "A" }, { detail: b, side: "B" }].map(({ detail, side }) => (
          <div key={side}>
            <div className="mb-5">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b]">Weekend {side}</p>
              <p className="font-serif font-bold text-xl text-[#0a0a0a] mt-0.5">{detail.dateRange}</p>
              {detail.marquee && <p className="text-[10px] tracking-wider uppercase text-[#b8860b] mt-0.5">{detail.marquee}</p>}
              {detail.historicalWeeks > 0 && (
                <p className="text-[10px] text-[#9b9b9b] mt-1">
                  Historically avg {formatGross(detail.historicalAvgGross)} across {detail.historicalWeeks} years
                </p>
              )}
            </div>
            {detail.scheduledReleases.length > 0
              ? detail.scheduledReleases.map((r, i) => (
                  <ScheduledRow key={i} release={r} myGenre={myGenre} />
                ))
              : <p className="text-sm text-[#9b9b9b] py-4">No confirmed releases yet.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Historical compare results ───────────────────────────────────────────────

function HistoricalResults({ a, b, myGenre }: { a: WeekendDetail; b: WeekendDetail; myGenre: Genre | null }) {
  const aFilms = [...a.openers, ...a.holdovers].sort((x, y) => (y.weekend_gross ?? 0) - (x.weekend_gross ?? 0)).slice(0, 10);
  const bFilms = [...b.openers, ...b.holdovers].sort((x, y) => (y.weekend_gross ?? 0) - (x.weekend_gross ?? 0)).slice(0, 10);
  const crossMax = Math.max(aFilms[0]?.weekend_gross ?? 0, bFilms[0]?.weekend_gross ?? 0, 1);
  const aTopOpener = a.openers[0]?.weekend_gross ?? 0;
  const bTopOpener = b.openers[0]?.weekend_gross ?? 0;
  const aGenreThreats = myGenre ? aFilms.filter(f => f.genre === myGenre).length : null;
  const bGenreThreats = myGenre ? bFilms.filter(f => f.genre === myGenre).length : null;
  const { grade: ga, color: ca } = scoreGrade(a.score);
  const { grade: gb, color: cb } = scoreGrade(b.score);

  return (
    <div>
      {myGenre && aGenreThreats !== null && bGenreThreats !== null && (
        <div className="mb-8 pb-8 border-b border-[#e5e5e5]">
          <p className="text-xs text-[#b8860b]">
            {myGenre} competition: <strong>{aGenreThreats}</strong> film{aGenreThreats !== 1 ? "s" : ""} on Weekend A
            {" · "}
            <strong>{bGenreThreats}</strong> film{bGenreThreats !== 1 ? "s" : ""} on Weekend B
            {aGenreThreats !== bGenreThreats && (
              <span className="text-emerald-600 ml-2">
                → Weekend {aGenreThreats < bGenreThreats ? "A" : "B"} has less {myGenre} competition
              </span>
            )}
          </p>
        </div>
      )}

      <div className={`grid gap-3 mb-12 ${myGenre ? "grid-cols-2 md:grid-cols-6" : "grid-cols-2 md:grid-cols-5"}`}>
        <VerdictCard
          label="Slot Score"
          valueA={<span style={{ color: ca }}>{ga} <span className="text-sm font-normal text-[#9b9b9b]">({a.score})</span></span>}
          valueB={<span style={{ color: cb }}>{gb} <span className="text-sm font-normal text-[#9b9b9b]">({b.score})</span></span>}
          winnerA={a.score === b.score ? null : a.score > b.score}
          winnerNote="↑ Better slot"
        />
        <VerdictCard
          label="Total Market"
          valueA={formatGross(a.totalGross)}
          valueB={formatGross(b.totalGross)}
          winnerA={a.totalGross === b.totalGross ? null : a.totalGross > b.totalGross}
          winnerNote="↑ Larger pie"
        />
        <VerdictCard
          label="New Openers"
          valueA={String(a.openers.length)}
          valueB={String(b.openers.length)}
          winnerA={a.openers.length === b.openers.length ? null : a.openers.length < b.openers.length}
          winnerNote="↓ Less crowded"
        />
        <VerdictCard
          label="Top Opener Gross"
          valueA={aTopOpener > 0 ? formatGross(aTopOpener) : "—"}
          valueB={bTopOpener > 0 ? formatGross(bTopOpener) : "—"}
          winnerA={aTopOpener === bTopOpener ? null : aTopOpener < bTopOpener}
          winnerNote="↓ Weaker #1 competition"
        />
        <VerdictCard
          label="Holiday"
          valueA={<span className={a.marquee ? "text-[#b8860b] text-base" : "text-[#c0c0c0] text-base"}>{a.marquee ?? "None"}</span>}
          valueB={<span className={b.marquee ? "text-[#b8860b] text-base" : "text-[#c0c0c0] text-base"}>{b.marquee ?? "None"}</span>}
          winnerA={a.marquee && !b.marquee ? true : !a.marquee && b.marquee ? false : null}
          winnerNote="↑ Built-in event demand"
        />
        {myGenre && aGenreThreats !== null && bGenreThreats !== null && (
          <VerdictCard
            label={`${myGenre} Threats`}
            valueA={String(aGenreThreats)}
            valueB={String(bGenreThreats)}
            winnerA={aGenreThreats === bGenreThreats ? null : aGenreThreats < bGenreThreats}
            winnerNote="↓ Fewer genre rivals"
          />
        )}
      </div>

      <p className="text-xs tracking-[0.25em] uppercase text-[#6b6b6b] mb-6">Competition Landscape</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {[{ detail: a, films: aFilms, side: "A" }, { detail: b, films: bFilms, side: "B" }].map(({ detail, films, side }) => (
          <div key={side}>
            <div className="mb-5">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[#9b9b9b]">Weekend {side}</p>
              <p className="font-serif font-bold text-xl text-[#0a0a0a] mt-0.5">{detail.dateRange}</p>
              {detail.marquee && <p className="text-[10px] tracking-wider uppercase text-[#b8860b] mt-0.5">{detail.marquee}</p>}
            </div>
            {films.length > 0
              ? films.map((film, i) => (
                  <HistoricalFilmRow key={`${side}-${film.film}-${i}`} film={film} rank={i + 1} maxGross={crossMax} myGenre={myGenre} />
                ))
              : <p className="text-sm text-[#9b9b9b] py-4">No data.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main compare page ────────────────────────────────────────────────────────

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const modeParam = searchParams.get("mode");
  const [mode, setMode] = useState<"upcoming" | "historical">(
    modeParam === "historical" ? "historical" : "upcoming"
  );
  const [w1, setW1] = useState(searchParams.get("w1") ?? "");
  const [w2, setW2] = useState(searchParams.get("w2") ?? "");
  const [myGenre, setMyGenre] = useState<Genre | null>(null);

  const [futureWeekends, setFutureWeekends] = useState<FutureWeekendSummary[]>([]);
  const [upcomingData, setUpcomingData] = useState<{ weekendA: FutureWeekendDetail; weekendB: FutureWeekendDetail } | null>(null);
  const [historicalData, setHistoricalData] = useState<{ weekendA: WeekendDetail; weekendB: WeekendDetail } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load future weekends list
  useEffect(() => {
    fetch("/api/future-weekends")
      .then(r => r.json())
      .then((d: { weekends: FutureWeekendSummary[] }) => setFutureWeekends(d.weekends));
  }, []);

  const updateUrl = useCallback((newW1: string, newW2: string) => {
    const p = new URLSearchParams();
    if (newW1) p.set("w1", newW1);
    if (newW2) p.set("w2", newW2);
    const qs = p.toString();
    router.replace(qs ? `/compare?${qs}` : "/compare", { scroll: false });
  }, [router]);

  const handleW1 = (id: string) => { setW1(id); setUpcomingData(null); setHistoricalData(null); updateUrl(id, w2); };
  const handleW2 = (id: string) => { setW2(id); setUpcomingData(null); setHistoricalData(null); updateUrl(w1, id); };
  const handleMode = (m: "upcoming" | "historical") => {
    setMode(m);
    setW1(""); setW2("");
    setUpcomingData(null); setHistoricalData(null);
    router.replace("/compare", { scroll: false });
  };

  // Fetch compare data when both weekends selected
  useEffect(() => {
    if (!w1 || !w2) return;
    setLoading(true);
    setError(null);
    const endpoint = mode === "upcoming" ? "/api/future-compare" : "/api/compare";
    fetch(`${endpoint}?w1=${w1}&w2=${w2}`)
      .then(r => { if (!r.ok) throw new Error("Could not load comparison data"); return r.json(); })
      .then(data => {
        if (mode === "upcoming") setUpcomingData(data);
        else setHistoricalData(data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [w1, w2, mode]);

  const hasData = mode === "upcoming" ? !!upcomingData : !!historicalData;

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs tracking-[0.25em] uppercase text-[#6b6b6b] mb-3">Weekend Comparison</p>
        <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#0a0a0a]">A vs B</h1>
        <p className="text-sm text-[#6b6b6b] mt-3 max-w-lg leading-relaxed">
          {mode === "upcoming"
            ? "Compare upcoming release slots — see confirmed competition from announced films and historical market size for each calendar period."
            : "Compare two historical weekends side by side: market size, competition, and slot attractiveness."}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-8">
        <ModeToggle mode={mode} onChange={handleMode} />
      </div>

      {/* Pickers */}
      <div className="flex flex-col sm:flex-row gap-8 mb-10">
        {mode === "upcoming" ? (
          <>
            <UpcomingPicker label="A" selectedId={w1} onSelect={handleW1} weekends={futureWeekends} />
            <div className="hidden sm:flex items-end pb-3 text-[#c0c0c0] text-sm font-light">vs</div>
            <UpcomingPicker label="B" selectedId={w2} onSelect={handleW2} weekends={futureWeekends} />
          </>
        ) : (
          <>
            <HistoricalPicker label="A" selectedId={w1} onSelect={handleW1} />
            <div className="hidden sm:flex items-end pb-3 text-[#c0c0c0] text-sm font-light">vs</div>
            <HistoricalPicker label="B" selectedId={w2} onSelect={handleW2} />
          </>
        )}
      </div>

      {/* Genre filter */}
      {hasData && (
        <div className="mb-8 pb-8 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#6b6b6b] shrink-0">My film is a</span>
            {ALL_GENRES.map((g) => {
              const isActive = myGenre === g;
              return (
                <button
                  key={g}
                  onClick={() => setMyGenre(isActive ? null : g)}
                  className={[
                    "text-xs px-2.5 py-1 border transition-colors",
                    isActive ? "border-[#b8860b] bg-[#b8860b] text-white" : "border-[#d0d0d0] text-[#0a0a0a] hover:border-[#0a0a0a]",
                  ].join(" ")}
                >
                  {g}
                </button>
              );
            })}
            {myGenre && (
              <button onClick={() => setMyGenre(null)} className="text-xs text-[#9b9b9b] hover:text-[#0a0a0a] transition-colors ml-1">
                clear ×
              </button>
            )}
          </div>
        </div>
      )}

      {!hasData && <div className="border-t border-[#e5e5e5] mb-10" />}

      {/* States */}
      {loading && <p className="text-sm text-[#6b6b6b] py-8 text-center">Loading…</p>}
      {error && <p className="text-sm text-red-500 py-4">{error}</p>}
      {!w1 && !w2 && !loading && (
        <div className="py-20 text-center">
          <p className="text-[#b0b0b0] text-sm">Select two weekends to compare them.</p>
        </div>
      )}
      {(w1 || w2) && !(w1 && w2) && !loading && (
        <div className="py-20 text-center">
          <p className="text-[#b0b0b0] text-sm">Now select {w1 ? "Weekend B" : "Weekend A"} →</p>
        </div>
      )}

      {/* Results */}
      {mode === "upcoming" && upcomingData && (
        <UpcomingResults a={upcomingData.weekendA} b={upcomingData.weekendB} myGenre={myGenre} />
      )}
      {mode === "historical" && historicalData && (
        <HistoricalResults a={historicalData.weekendA} b={historicalData.weekendB} myGenre={myGenre} />
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-8 py-12"><p className="text-sm text-[#6b6b6b]">Loading…</p></div>}>
      <ComparePageInner />
    </Suspense>
  );
}
