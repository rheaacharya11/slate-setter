"use client";

import { useRouter } from "next/navigation";

interface Props {
  years: number[];
  activeYear: number;
}

export default function YearSelector({ years, activeYear }: Props) {
  const router = useRouter();

  return (
    <div className="flex gap-6">
      {years.map((year) => {
        const isActive = year === activeYear;
        return (
          <button
            key={year}
            onClick={() => router.push(`/?year=${year}`)}
            className={[
              "pb-1 text-sm font-medium transition-colors",
              isActive
                ? "border-b-2 border-[#0a0a0a] text-[#0a0a0a]"
                : "border-b-2 border-transparent text-[#6b6b6b] hover:text-[#0a0a0a]",
            ].join(" ")}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
