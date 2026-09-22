import { NextRequest, NextResponse } from "next/server";
import { getAwardTrips } from "@/lib/seatsAero";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await getAwardTrips(id);
    return NextResponse.json({ provider: "Seats.aero", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
