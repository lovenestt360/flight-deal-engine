import { NextRequest, NextResponse } from "next/server";
import { evaluateObservedQuote } from "@/lib/quoteEvaluator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      quote,
      targetMilesNeeded,
      targetMilesProduced,
      awardTaxesUSD = 0,
      cashBaselineUSD,
      usdPerQuoteCurrency,
    } = body ?? {};

    if (
      !quote?.sourceProgram ||
      !Number.isFinite(Number(quote?.sourceUnitsPurchased)) ||
      !Number.isFinite(Number(quote?.totalPrice)) ||
      !quote?.currency ||
      !Number.isFinite(Number(targetMilesNeeded)) ||
      !Number.isFinite(Number(targetMilesProduced)) ||
      !Number.isFinite(Number(cashBaselineUSD))
    ) {
      return NextResponse.json(
        { error: "Invalid quote evaluation payload" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      evaluateObservedQuote({
        quote: {
          ...quote,
          sourceUnitsPurchased: Number(quote.sourceUnitsPurchased),
          bonusUnits: Number(quote.bonusUnits ?? 0),
          totalPrice: Number(quote.totalPrice),
        },
        targetMilesNeeded: Number(targetMilesNeeded),
        targetMilesProduced: Number(targetMilesProduced),
        awardTaxesUSD: Number(awardTaxesUSD ?? 0),
        cashBaselineUSD: Number(cashBaselineUSD),
        usdPerQuoteCurrency:
          usdPerQuoteCurrency === undefined
            ? undefined
            : Number(usdPerQuoteCurrency),
      })
    );
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
