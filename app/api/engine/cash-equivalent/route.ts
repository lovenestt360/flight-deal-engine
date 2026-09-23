import { NextRequest, NextResponse } from "next/server";
import { quoteMilesPurchase } from "@/lib/milesPricing";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const program = q.get("program") ?? "";
  const miles = Number(q.get("miles") ?? 0);
  const taxes = Number(q.get("taxes") ?? 0);
  const taxesCurrency = q.get("taxesCurrency") ?? "USD";
  const publicCashUSD = Number(q.get("publicCashUSD") ?? 0);

  if (!program || !Number.isFinite(miles) || miles <= 0) {
    return NextResponse.json({ error: "program and positive miles are required" }, { status: 400 });
  }

  const acquisition = quoteMilesPurchase(program, miles);
  const sameCurrency = acquisition.currency === taxesCurrency;
  const totalCash =
    acquisition.purchaseCost !== null && sameCurrency
      ? Number((acquisition.purchaseCost + taxes).toFixed(2))
      : null;

  return NextResponse.json({
    acquisition,
    taxes: { amount: taxes, currency: taxesCurrency },
    totalCash: totalCash === null ? null : { amount: totalCash, currency: acquisition.currency },
    publicCashUSD: publicCashUSD > 0 ? publicCashUSD : null,
    comparison:
      totalCash !== null && acquisition.currency === "USD" && publicCashUSD > 0
        ? {
            savingUSD: Number((publicCashUSD - totalCash).toFixed(2)),
            beatsCash: totalCash < publicCashUSD,
          }
        : null,
    rule:
      "Never buy points until award availability, taxes/surcharges, purchase eligibility and final redemption pricing are confirmed.",
  });
}
