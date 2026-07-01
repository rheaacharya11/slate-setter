"use client";

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { MouseHandlerDataParam } from "recharts/types/synchronisation/types";
import { useRouter } from "next/navigation";
import type { WeekendSummary } from "@/lib/types";
import { formatGross } from "@/lib/format";

interface Props {
  data: WeekendSummary[];
}

interface TooltipPayload {
  payload?: WeekendSummary;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-white border border-[#e5e5e5] shadow-sm px-4 py-3 min-w-[200px]">
      <p className="font-serif font-bold text-base text-[#0a0a0a]">{d.dateRange}</p>
      {d.marquee && (
        <p className="text-xs tracking-[0.2em] uppercase text-[#b8860b] mt-0.5">
          {d.marquee}
        </p>
      )}
      <p className="font-serif font-bold text-2xl text-[#0a0a0a] mt-2">
        {formatGross(d.totalGross)}
      </p>
      <p className="text-xs text-[#6b6b6b] mt-1">{d.topFilm}</p>
      <p className="text-xs text-[#6b6b6b]">
        {d.filmCount} film{d.filmCount !== 1 ? "s" : ""} in release
      </p>
    </div>
  );
}

export default function AnnualChart({ data }: Props) {
  const router = useRouter();

  function handleClick(state: MouseHandlerDataParam) {
    const idx = state?.activeIndex;
    if (idx == null || typeof idx !== "number") return;
    const weekend = data[idx];
    if (weekend?.id) {
      router.push(`/weekend/${weekend.id}`);
    }
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        <XAxis
          dataKey="dateLabel"
          interval={3}
          tick={{ fontSize: 10, fill: "#6b6b6b", fontFamily: "var(--font-inter)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "#f5f5f4" }}
        />
        <Bar dataKey="totalGross" radius={[1, 1, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.id}
              fill={entry.marquee ? "#b8860b" : "#0a0a0a"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
