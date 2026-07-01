import type { FilmRecord } from "@/lib/types";
import { formatGross } from "@/lib/format";

interface Props {
  films: FilmRecord[];
  showWeekBadge?: boolean;
  limit?: number;
}

export default function FilmTable({ films, showWeekBadge = false, limit }: Props) {
  if (films.length === 0) {
    return (
      <p className="text-sm text-[#6b6b6b] py-6">No data available.</p>
    );
  }

  const visible = limit ? films.slice(0, limit) : films;
  const hidden = films.length - visible.length;

  return (
    <>
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e5e5]">
          <th className="text-left py-2 pr-4 text-xs tracking-[0.2em] uppercase text-[#6b6b6b] font-normal w-8">
            #
          </th>
          <th className="text-left py-2 pr-4 text-xs tracking-[0.2em] uppercase text-[#6b6b6b] font-normal">
            Film
          </th>
          <th className="text-right py-2 pr-4 text-xs tracking-[0.2em] uppercase text-[#6b6b6b] font-normal">
            Weekend
          </th>
          <th className="text-right py-2 pr-4 text-xs tracking-[0.2em] uppercase text-[#6b6b6b] font-normal hidden sm:table-cell">
            Theaters
          </th>
          {showWeekBadge && (
            <th className="text-right py-2 text-xs tracking-[0.2em] uppercase text-[#6b6b6b] font-normal hidden md:table-cell">
              Week
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {visible.map((film, i) => (
          <tr
            key={`${film.film}-${i}`}
            className="border-b border-[#f0f0f0] hover:bg-[#fafaf9] transition-colors"
          >
            <td className="py-4 pr-4 text-sm text-[#6b6b6b] tabular-nums align-top">
              {i + 1}
            </td>
            <td className="py-4 pr-4 align-top">
              <p className="text-sm font-medium text-[#0a0a0a] leading-snug">
                {film.film}
              </p>
              {film.distributor && (
                <p className="text-xs text-[#6b6b6b] mt-0.5">{film.distributor}</p>
              )}
            </td>
            <td className="py-4 pr-4 text-right align-top">
              <span className="font-serif font-bold text-sm text-[#0a0a0a]">
                {film.weekend_gross != null ? formatGross(film.weekend_gross) : "—"}
              </span>
            </td>
            <td className="py-4 pr-4 text-right text-sm text-[#6b6b6b] hidden sm:table-cell align-top tabular-nums">
              {film.theater_count != null
                ? film.theater_count.toLocaleString("en-US")
                : "—"}
            </td>
            {showWeekBadge && (
              <td className="py-4 text-right hidden md:table-cell align-top">
                <span className="text-xs text-[#6b6b6b] tabular-nums">
                  {film.week_number_in_release != null
                    ? `WK ${film.week_number_in_release}`
                    : "—"}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
    {hidden > 0 && (
      <p className="text-xs text-[#6b6b6b] mt-4">
        + {hidden} more films in limited release
      </p>
    )}
    </>
  );
}
