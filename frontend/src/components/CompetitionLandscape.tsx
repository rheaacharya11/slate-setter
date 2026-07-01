"use client";

import { useState } from "react";
import type { FilmRecord } from "@/lib/types";
import type { Genre } from "@/lib/genres";
import { ALL_GENRES } from "@/lib/genres";
import { formatGross } from "@/lib/format";

interface Props {
  films: FilmRecord[];
  totalGross: number;
}

export default function CompetitionLandscape({ films, totalGross }: Props) {
  const [myGenre, setMyGenre] = useState<Genre | null>(null);

  const maxFilmGross = films[0]?.weekend_gross ?? 1;

  // Which genres actually appear in this weekend's films
  const presentGenres = ALL_GENRES.filter((g) =>
    films.some((f) => f.genre === g)
  );

  const directThreats = myGenre
    ? films.filter((f) => f.genre === myGenre)
    : [];

  return (
    <section>
      {/* Genre filter */}
      <div className="mb-6">
        <p className="text-xs tracking-[0.25em] uppercase text-[#6b6b6b] mb-3">
          Competition Landscape
        </p>

        {/* "My film is a…" selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#6b6b6b] shrink-0">My film is a</span>
          {ALL_GENRES.map((g) => {
            const isActive = myGenre === g;
            const hasFilms = presentGenres.includes(g);
            return (
              <button
                key={g}
                onClick={() => setMyGenre(isActive ? null : g)}
                className={[
                  "text-xs px-2.5 py-1 border transition-colors",
                  isActive
                    ? "border-[#b8860b] bg-[#b8860b] text-white"
                    : hasFilms
                    ? "border-[#d0d0d0] text-[#0a0a0a] hover:border-[#0a0a0a]"
                    : "border-[#e5e5e5] text-[#b0b0b0]",
                ].join(" ")}
              >
                {g}
              </button>
            );
          })}
          {myGenre && (
            <button
              onClick={() => setMyGenre(null)}
              className="text-xs text-[#9b9b9b] hover:text-[#0a0a0a] transition-colors ml-1"
            >
              clear ×
            </button>
          )}
        </div>

        {/* Threat summary */}
        {myGenre && (
          <div className="mt-3 flex items-baseline gap-2">
            {directThreats.length > 0 ? (
              <p className="text-xs text-[#b8860b]">
                <span className="font-medium">{directThreats.length}</span>{" "}
                {myGenre} film{directThreats.length !== 1 ? "s" : ""} competing
                this weekend
                {directThreats.some((f) => f.is_new_release) &&
                  ` · ${directThreats.filter((f) => f.is_new_release).length} opening`}
              </p>
            ) : (
              <p className="text-xs text-emerald-600">
                No {myGenre} competition this weekend
              </p>
            )}
          </div>
        )}
      </div>

      {/* Film rows */}
      <div>
        {films.map((film, i) => {
          const gross = film.weekend_gross ?? 0;
          const share = totalGross > 0 ? (gross / totalGross) * 100 : 0;
          const barWidth = maxFilmGross > 0 ? (gross / maxFilmGross) * 100 : 0;
          const isDirectThreat = myGenre !== null && film.genre === myGenre;
          const isDimmed = myGenre !== null && film.genre !== myGenre;

          return (
            <div
              key={`${film.film}-${i}`}
              className={[
                "py-4 border-b border-[#f0f0f0] transition-opacity",
                isDimmed ? "opacity-30" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {/* Rank */}
                <span className="text-sm text-[#c0c0c0] w-6 shrink-0 tabular-nums mt-0.5">
                  {i + 1}
                </span>

                {/* Film info + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#0a0a0a]">
                      {film.film}
                    </span>

                    {/* New / holdover badge */}
                    {film.is_new_release ? (
                      <span className="text-[9px] tracking-[0.15em] px-1.5 py-0.5 bg-[#0a0a0a] text-white uppercase">
                        New
                      </span>
                    ) : (
                      <span className="text-[9px] tracking-[0.1em] px-1.5 py-0.5 bg-[#f0f0f0] text-[#6b6b6b] uppercase">
                        Wk {film.week_number_in_release ?? "?"}
                      </span>
                    )}

                    {/* Genre tag — highlighted if it's a direct threat */}
                    {film.genre && (
                      <span
                        className={[
                          "text-[9px] px-1.5 py-0.5 uppercase tracking-wider",
                          isDirectThreat
                            ? "bg-[#b8860b] text-white"
                            : "text-[#9b9b9b]",
                        ].join(" ")}
                      >
                        {film.genre}
                      </span>
                    )}

                    {film.distributor && (
                      <span className="text-xs text-[#b0b0b0]">
                        {film.distributor}
                      </span>
                    )}
                  </div>

                  {/* Gross bar */}
                  <div className="mt-2 h-1.5 bg-[#f0f0f0] w-full max-w-sm">
                    <div
                      style={{ width: `${barWidth}%`, height: "100%" }}
                      className={
                        isDirectThreat
                          ? "bg-[#b8860b]"
                          : film.is_new_release
                          ? "bg-[#0a0a0a]"
                          : "bg-[#b0b0b0]"
                      }
                    />
                  </div>
                </div>

                {/* Gross + share */}
                <div className="text-right shrink-0">
                  <span className="font-serif font-bold text-sm text-[#0a0a0a]">
                    {formatGross(gross)}
                  </span>
                  <p className="text-xs text-[#9b9b9b] mt-0.5">
                    {share.toFixed(0)}% share
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
