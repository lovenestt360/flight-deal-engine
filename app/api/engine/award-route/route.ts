import { NextRequest, NextResponse } from "next/server";
import { Cabin, searchRoundTripAwardRoutes } from "@/lib/awardRouter";

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_CABINS = new Set<Cabin>(["economy", "premium", "business", "first"]);
const DEFAULT_HUBS = ["DOH", "JNB", "ADD", "DXB", "AUH", "IST"];

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const origin = (q.get("origin") ?? "").toUpperCase();
    const destination = (q.get("destination") ?? "").toUpperCase();
    const outboundDate = q.get("outboundDate") ?? "";
    const returnDate = q.get("returnDate") ?? undefined;
    const cabin = (q.get("cabin") ?? "economy") as Cabin;
    const hubs = (q.get("hubs")?.split(",") ?? DEFAULT_HUBS)
      .map((x) => x.trim().toUpperCase())
      .filter((x) => IATA.test(x) && x !== origin && x !== destination)
      .slice(0, 6);

    const minLayoverMinutes = Number(q.get("minLayoverMinutes") ?? 60);
    const maxLayoverHours = Number(q.get("maxLayoverHours") ?? 36);

    if (!IATA.test(origin) || !IATA.test(destination)) {
      return NextResponse.json({ error: "origin and destination must be 3-letter IATA codes" }, { status: 400 });
    }
    if (!DATE.test(outboundDate) || (returnDate && !DATE.test(returnDate))) {
      return NextResponse.json({ error: "dates must be YYYY-MM-DD" }, { status: 400 });
    }
    if (!VALID_CABINS.has(cabin)) {
      return NextResponse.json({ error: "invalid cabin" }, { status: 400 });
    }
    if (!hubs.length) {
      return NextResponse.json({ error: "provide at least one valid hub" }, { status: 400 });
    }

    const result = await searchRoundTripAwardRoutes({
      origin,
      destination,
      outboundDate,
      returnDate,
      hubs,
      cabin,
      minLayoverMinutes: Math.max(30, Math.min(minLayoverMinutes, 360)),
      maxLayoverMinutes: Math.max(6, Math.min(maxLayoverHours, 48)) * 60,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
