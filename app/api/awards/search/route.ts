import { NextRequest, NextResponse } from "next/server";
import { searchCachedAwards } from "@/lib/seatsAero";

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cabins = new Set(["economy", "premium", "business", "first"]);

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const origin = (q.get("origin") ?? "").toUpperCase();
    const destination = (q.get("destination") ?? "").toUpperCase();
    const startDate = q.get("startDate") ?? undefined;
    const endDate = q.get("endDate") ?? startDate;
    const cabin = q.get("cabin") ?? "economy";
    const sources = q.get("sources")?.split(",").filter(Boolean);
    const carriers = q.get("carriers")?.split(",").filter(Boolean);

    if (!IATA.test(origin) || !IATA.test(destination)) {
      return NextResponse.json({ error: "origin and destination must be 3-letter IATA codes" }, { status: 400 });
    }
    if (startDate && !DATE.test(startDate)) {
      return NextResponse.json({ error: "startDate must be YYYY-MM-DD" }, { status: 400 });
    }
    if (endDate && !DATE.test(endDate)) {
      return NextResponse.json({ error: "endDate must be YYYY-MM-DD" }, { status: 400 });
    }
    if (!cabins.has(cabin)) {
      return NextResponse.json({ error: "invalid cabin" }, { status: 400 });
    }

    const data = await searchCachedAwards({
      origin,
      destination,
      startDate,
      endDate,
      cabin: cabin as "economy" | "premium" | "business" | "first",
      sources,
      carriers,
      includeTrips: true,
      orderBy: "lowest_mileage",
    });

    return NextResponse.json({
      provider: "Seats.aero",
      searchType: "cached",
      note: "Personal Pro API keys support cached search; live search requires a commercial Seats.aero agreement.",
      query: { origin, destination, startDate, endDate, cabin, sources, carriers },
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
