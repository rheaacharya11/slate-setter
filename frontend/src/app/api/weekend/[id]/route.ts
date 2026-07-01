import { NextRequest, NextResponse } from "next/server";
import { getWeekendDetail } from "@/lib/data";

function parseWeekendId(id: string): { year: number; week: number } | null {
  const match = id.match(/^(\d{4})W(\d{1,2})$/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = parseWeekendId(id);

  if (!parsed) {
    return NextResponse.json({ error: "Invalid weekend ID format" }, { status: 400 });
  }

  const detail = getWeekendDetail(parsed.year, parsed.week);

  if (!detail) {
    return NextResponse.json({ error: "Weekend not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
