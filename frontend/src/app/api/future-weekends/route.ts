import { NextRequest, NextResponse } from "next/server";
import { getFutureWeekends } from "@/lib/data";

export async function GET(request: NextRequest) {
  const majorStudiosOnly = new URL(request.url).searchParams.get("studios") === "major";
  const weekends = getFutureWeekends({ majorStudiosOnly });
  return NextResponse.json({ weekends });
}
