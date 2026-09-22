import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "flight-deal-engine",
    seatsAeroConfigured: Boolean(process.env.SEATS_AERO_API_KEY),
  });
}
