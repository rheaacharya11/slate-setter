"use client";

import { useRouter } from "next/navigation";
import { ALL_GENRES } from "@/lib/genres";
import type { Genre } from "@/lib/genres";

interface Props {
  activeGenre: Genre | null;
  year: number;
}

export default function GenreFilter({ activeGenre, year }: Props) {
  const router = useRouter();

  function select(g: Genre | null) {
    const params = new URLSearchParams();
    params.set("year", String(year));
    if (g) params.set("genre", g);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-[#6b6b6b] shrink-0">My film is a</span>
      {ALL_GENRES.map((g) => (
        <button
          key={g}
          onClick={() => select(activeGenre === g ? null : g)}
          className={[
            "text-xs px-2.5 py-1 border transition-colors",
            activeGenre === g
              ? "border-[#b8860b] bg-[#b8860b] text-white"
              : "border-[#d0d0d0] text-[#0a0a0a] hover:border-[#0a0a0a]",
          ].join(" ")}
        >
          {g}
        </button>
      ))}
      {activeGenre && (
        <button
          onClick={() => select(null)}
          className="text-xs text-[#9b9b9b] hover:text-[#0a0a0a] transition-colors ml-1"
        >
          clear ×
        </button>
      )}
    </div>
  );
}
