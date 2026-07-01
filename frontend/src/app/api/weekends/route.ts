import { NextRequest, NextResponse } from "next/server";
import { getWeekendSummaries, getAvailableYears } from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const summaries = getWeekendSummaries(year);
  const availableYears = getAvailableYears();

  return NextResponse.json({ summaries, availableYears });
}
