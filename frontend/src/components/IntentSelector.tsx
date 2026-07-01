"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ALL_GENRES } from "@/lib/genres";
import type { Genre } from "@/lib/genres";

interface Props {
  genre: Genre | null;
  year: number;
  futureYears: number[];
  historicalYears: number[];
  studiosOnly?: boolean;
}

export default function IntentSelector({ genre, year, futureYears, historicalYears, studiosOnly }: Props) {
  const router = useRouter();
  const [genreOpen, setGenreOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const genreRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) setGenreOpen(false);
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setYearOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function navigate(nextGenre: Genre | null, nextYear: number) {
    const p = new URLSearchParams();
    p.set("year", String(nextYear));
    if (nextGenre) p.set("genre", nextGenre);
    if (studiosOnly) p.set("studios", "major");
    router.push(`/?${p}`);
  }

  const isFuture = futureYears.includes(year);

  return (
    <div>
      <p className="text-[10px] tracking-[0.25em] uppercase text-[#9b9b9b] mb-3">
        {isFuture ? "Release Planner" : "Box Office Calendar"}
      </p>
      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
        <span className="font-serif text-4xl font-bold text-[#0a0a0a]">
          {isFuture ? "I'm planning" : "Looking at"}
        </span>

        {/* Genre selector */}
        <div ref={genreRef} className="relative inline-block">
          <button
            onClick={() => { setGenreOpen(o => !o); setYearOpen(false); }}
            className="font-serif text-4xl font-bold underline underline-offset-4 decoration-[#e5e5e5] hover:decoration-[#0a0a0a] transition-colors text-[#0a0a0a]"
          >
            {genre ? `a ${genre}` : isFuture ? "a film" : "all genres"}
          </button>
          {genreOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e5e5] shadow-sm z-50 min-w-[160px] py-1">
              <button
                onClick={() => { navigate(null, year); setGenreOpen(false); }}
                className={[
                  "w-full text-left px-4 py-2 text-sm hover:bg-[#fafaf9] transition-colors",
                  !genre ? "font-bold text-[#0a0a0a]" : "text-[#6b6b6b]",
                ].join(" ")}
              >
                {isFuture ? "Any genre" : "All genres"}
              </button>
              <div className="border-t border-[#f0f0f0] my-1" />
              {ALL_GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => { navigate(g, year); setGenreOpen(false); }}
                  className={[
                    "w-full text-left px-4 py-2 text-sm hover:bg-[#fafaf9] transition-colors",
                    genre === g ? "font-bold text-[#0a0a0a]" : "text-[#6b6b6b]",
                  ].join(" ")}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="font-serif text-4xl font-bold text-[#0a0a0a]">release in</span>

        {/* Year selector */}
        <div ref={yearRef} className="relative inline-block">
          <button
            onClick={() => { setYearOpen(o => !o); setGenreOpen(false); }}
            className="font-serif text-4xl font-bold underline underline-offset-4 decoration-[#e5e5e5] hover:decoration-[#0a0a0a] transition-colors text-[#0a0a0a]"
          >
            {year}
          </button>
          {yearOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e5e5] shadow-sm z-50 min-w-[100px] py-1">
              {futureYears.length > 0 && (
                <>
                  <p className="px-4 py-1 text-[9px] tracking-wider uppercase text-[#9b9b9b]">Upcoming</p>
                  {futureYears.map(y => (
                    <button
                      key={y}
                      onClick={() => { navigate(genre, y); setYearOpen(false); }}
                      className={[
                        "w-full text-left px-4 py-2 text-sm hover:bg-[#fafaf9] transition-colors",
                        year === y ? "font-bold text-[#0a0a0a]" : "text-[#6b6b6b]",
                      ].join(" ")}
                    >
                      {y}
                    </button>
                  ))}
                </>
              )}
              {historicalYears.length > 0 && (
                <>
                  <div className="border-t border-[#f0f0f0] my-1" />
                  <p className="px-4 py-1 text-[9px] tracking-wider uppercase text-[#9b9b9b]">Historical</p>
                  {historicalYears.map(y => (
                    <button
                      key={y}
                      onClick={() => { navigate(genre, y); setYearOpen(false); }}
                      className={[
                        "w-full text-left px-4 py-2 text-sm hover:bg-[#fafaf9] transition-colors",
                        year === y ? "font-bold text-[#0a0a0a]" : "text-[#6b6b6b]",
                      ].join(" ")}
                    >
                      {y}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <span className="font-serif text-4xl font-bold text-[#0a0a0a]">.</span>
      </div>

      {/* Context line */}
      <p className="text-sm text-[#9b9b9b] mt-3 max-w-lg">
        {isFuture
          ? genre
            ? `Drag across the timeline to compare weeks. The panel below shows your competition and what changes if you swap dates.`
            : `Select a genre above to see genre-adjusted scores and competition. Drag to explore weeks.`
          : genre
            ? `Slot scores adjusted for ${genre} competition. Weeks with no same-genre competition score higher.`
            : `Historical box office by weekend. Click any cell to drill in.`}
      </p>
    </div>
  );
}
