"use client";

import { useRouter } from "next/navigation";

interface Props {
  active: boolean;
  year: number;
  genre?: string | null;
}

export default function StudioFilter({ active, year, genre }: Props) {
  const router = useRouter();

  function toggle() {
    const params = new URLSearchParams();
    params.set("year", String(year));
    if (genre) params.set("genre", genre);
    if (!active) params.set("studios", "major");
    router.push(`/?${params.toString()}`);
  }

  return (
    <button
      onClick={toggle}
      className={[
        "text-xs px-2.5 py-1 border transition-colors",
        active
          ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
          : "border-[#d0d0d0] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a]",
      ].join(" ")}
      title="Only count competition from major studios (A24, Universal, Disney, WB, Paramount, Sony, MGM, Lionsgate, Neon, etc.)"
    >
      Major studios only
    </button>
  );
}
