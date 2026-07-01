import { NextRequest, NextResponse } from "next/server";
import { getWeekendDetail } from "@/lib/data";

function parseWeekendId(id: string): { year: number; week: number } | null {
  const match = id.match(/^(\d{4})W(\d{1,2})$/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const w1 = searchParams.get("w1");
  const w2 = searchParams.get("w2");

  if (!w1 || !w2) {
    return NextResponse.json(
      { error: "Both w1 and w2 query parameters are required" },
      { status: 400 }
    );
  }

  const parsed1 = parseWeekendId(w1);
  const parsed2 = parseWeekendId(w2);

  if (!parsed1 || !parsed2) {
    return NextResponse.json({ error: "Invalid weekend ID format" }, { status: 400 });
  }

  const weekendA = getWeekendDetail(parsed1.year, parsed1.week);
  const weekendB = getWeekendDetail(parsed2.year, parsed2.week);

  if (!weekendA || !weekendB) {
    return NextResponse.json(
      { error: "One or both weekends not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ weekendA, weekendB });
}
