import { NextRequest, NextResponse } from "next/server";
import { buildMilesAcquisitionMarket, AccountMode } from "@/lib/milesMarket";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const targetProgram = q.get("targetProgram") ?? "";
  const targetMiles = Number(q.get("targetMiles") ?? 0);
  const cashBaselineUSD = Number(q.get("cashBaselineUSD") ?? 0);
  const awardTaxesUSD = Number(q.get("awardTaxesUSD") ?? 0);
  const accountMode = (q.get("accountMode") ?? "new") as AccountMode;

  if (
    !targetProgram ||
    !Number.isFinite(targetMiles) ||
    targetMiles <= 0 ||
    !Number.isFinite(cashBaselineUSD) ||
    cashBaselineUSD <= 0
  ) {
    return NextResponse.json(
      { error: "targetProgram, positive targetMiles and positive cashBaselineUSD are required" },
      { status: 400 }
    );
  }

  if (!["new", "existing_unknown"].includes(accountMode)) {
    return NextResponse.json(
      { error: "accountMode must be new or existing_unknown" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    buildMilesAcquisitionMarket({
      targetProgram,
      targetMiles,
      cashBaselineUSD,
      awardTaxesUSD:
        Number.isFinite(awardTaxesUSD) && awardTaxesUSD >= 0
          ? awardTaxesUSD
          : 0,
      accountMode,
    })
  );
}
