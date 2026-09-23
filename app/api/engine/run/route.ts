import { NextRequest, NextResponse } from "next/server";
import { searchRoundTripAwardRoutes, Cabin } from "@/lib/awardRouter";
import { cheapestAcquisitionRoutes } from "@/lib/acquisitionOptimizer";
import { activeAcquisitionPromotions } from "@/lib/acquisitionPromotions";
import { subscriptionFeasibility } from "@/lib/subscriptionPricing";

type EngineStatus =
  | "READY_TO_BOOK"
  | "LOGIN_REQUIRED"
  | "DO_NOT_BUY_POINTS_YET"
  | "REJECT";

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CABINS = new Set<Cabin>(["economy", "premium", "business", "first"]);
const DEFAULT_HUBS = ["DOH", "JNB", "ADD", "DXB", "AUH", "IST"];

function awardStatus(
  pair: any,
  acquisition: any,
  cashBaselineUSD: number | null
): {
  status: EngineStatus;
  totalCash: { amount: number; currency: string } | null;
  reason: string;
} {
  if (!acquisition?.acquisitionPurchasable) {
    return {
      status: "REJECT",
      totalCash: null,
      reason: "The required source currency cannot be purchased in sufficient quantity under the configured annual/account limits.",
    };
  }

  const constructed =
    pair?.outbound?.routeType === "constructed_one_stop" ||
    pair?.return?.routeType === "constructed_one_stop";

  if (
    pair?.doNotBuyPointsYet ||
    pair?.verificationStatus !== "CACHED_RECENT" ||
    constructed
  ) {
    return {
      status: "DO_NOT_BUY_POINTS_YET",
      totalCash: null,
      reason: constructed
        ? "Award is built from segment-level inventory and must be re-priced/confirmed as a valid redeemable itinerary before buying points."
        : "Award availability is stale or incomplete and must be refreshed before buying points.",
    };
  }

  if (!pair?.taxes?.known) {
    return {
      status: "DO_NOT_BUY_POINTS_YET",
      totalCash: null,
      reason: "Taxes/surcharges are not confirmed.",
    };
  }

  if (acquisition?.acquisitionCost == null) {
    return {
      status: "LOGIN_REQUIRED",
      totalCash: null,
      reason: "Exact points purchase price requires the loyalty-program checkout/login.",
    };
  }

  const acquisitionCurrency = String(acquisition.acquisitionCurrency ?? "");
  const taxCurrency = String(pair.taxes.currency ?? "");
  if (!acquisitionCurrency || acquisitionCurrency !== taxCurrency) {
    return {
      status: "LOGIN_REQUIRED",
      totalCash: null,
      reason: "A live FX conversion is required before the all-in cash cost can be compared.",
    };
  }

  const total = Number(
    (
      Number(acquisition.acquisitionCost) +
      Number(pair.taxes.amount ?? 0)
    ).toFixed(2)
  );

  if (
    cashBaselineUSD &&
    acquisitionCurrency === "USD" &&
    total >= cashBaselineUSD
  ) {
    return {
      status: "REJECT",
      totalCash: { amount: total, currency: acquisitionCurrency },
      reason: "All-in award acquisition cost is not cheaper than the supplied cash baseline.",
    };
  }

  return {
    status: "READY_TO_BOOK",
    totalCash: { amount: total, currency: acquisitionCurrency },
    reason: "Award, taxes and acquisition cost are sufficiently confirmed by the configured rules.",
  };
}

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const origin = (q.get("origin") ?? "").toUpperCase();
    const destination = (q.get("destination") ?? "").toUpperCase();
    const outboundDate = q.get("outboundDate") ?? "";
    const returnDate = q.get("returnDate") ?? undefined;
    const cabin = (q.get("cabin") ?? "economy") as Cabin;
    const passengers = Math.max(1, Math.min(Number(q.get("passengers") ?? 1), 9));
    const milesOwned = Math.max(0, Number(q.get("milesOwned") ?? 0));
    const cashBaselineUSDValue = Number(q.get("cashBaselineUSD") ?? 0);
    const cashBaselineUSD =
      Number.isFinite(cashBaselineUSDValue) && cashBaselineUSDValue > 0
        ? cashBaselineUSDValue
        : null;
    const hubs = (q.get("hubs")?.split(",") ?? DEFAULT_HUBS)
      .map((x) => x.trim().toUpperCase())
      .filter((x) => IATA.test(x) && x !== origin && x !== destination)
      .slice(0, 6);

    if (!IATA.test(origin) || !IATA.test(destination)) {
      return NextResponse.json(
        { error: "origin and destination must be 3-letter IATA codes" },
        { status: 400 }
      );
    }
    if (!DATE.test(outboundDate) || (returnDate && !DATE.test(returnDate))) {
      return NextResponse.json(
        { error: "dates must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (!CABINS.has(cabin)) {
      return NextResponse.json({ error: "invalid cabin" }, { status: 400 });
    }

    const awards = await searchRoundTripAwardRoutes({
      origin,
      destination,
      outboundDate,
      returnDate,
      hubs,
      cabin,
      minLayoverMinutes: 60,
      maxLayoverMinutes: 36 * 60,
    });

    const awardOptions: any[] = [];

    for (const pair of awards.roundTripPairs.slice(0, 12)) {
      const totalMilesForParty = Math.max(
        0,
        Number(pair.miles) * passengers - milesOwned
      );

      const acquisitions = cheapestAcquisitionRoutes(
        String(pair.source),
        totalMilesForParty
      ).slice(0, 8);

      for (const acquisition of acquisitions) {
        const assessment = awardStatus(pair, acquisition, cashBaselineUSD);
        awardOptions.push({
          optionType: "award",
          program: pair.program,
          awardSource: pair.source,
          milesRequired: totalMilesForParty,
          passengers,
          milesOwned,
          taxes: pair.taxes,
          acquisition,
          status: assessment.status,
          totalCash: assessment.totalCash,
          reason: assessment.reason,
          outbound: pair.outbound,
          return: pair.return,
        });
      }
    }

    const rank = {
      READY_TO_BOOK: 0,
      LOGIN_REQUIRED: 1,
      DO_NOT_BUY_POINTS_YET: 2,
      REJECT: 3,
    } as const;

    awardOptions.sort((a, b) => {
      const rs = rank[a.status as keyof typeof rank] - rank[b.status as keyof typeof rank];
      if (rs) return rs;
      const aUSD =
        a.totalCash?.currency === "USD"
          ? Number(a.totalCash.amount)
          : Number.POSITIVE_INFINITY;
      const bUSD =
        b.totalCash?.currency === "USD"
          ? Number(b.totalCash.amount)
          : Number.POSITIVE_INFINITY;
      if (aUSD !== bUSD) return aUSD - bUSD;
      return Number(a.milesRequired) - Number(b.milesRequired);
    });

    const cashOption = cashBaselineUSD
      ? {
          optionType: "cash",
          method: "public cash baseline",
          totalCash: { amount: cashBaselineUSD, currency: "USD" },
          status: "READY_TO_BOOK" as EngineStatus,
          reason:
            "Supplied live cash baseline. Recheck checkout price before payment.",
        }
      : null;

    const readyKnownUSD = [
      ...(cashOption ? [cashOption] : []),
      ...awardOptions.filter(
        (o) =>
          o.status === "READY_TO_BOOK" &&
          o.totalCash?.currency === "USD" &&
          Number.isFinite(Number(o.totalCash?.amount))
      ),
    ].sort(
      (a: any, b: any) =>
        Number(a.totalCash.amount) - Number(b.totalCash.amount)
    );

    const bestExecutable = readyKnownUSD[0] ?? null;

    const relevantPromotions = activeAcquisitionPromotions(
      new Date(`${outboundDate}T12:00:00Z`)
    );

    return NextResponse.json({
      engineVersion: "0.3.0",
      query: {
        origin,
        destination,
        outboundDate,
        returnDate,
        cabin,
        passengers,
        milesOwned,
        hubs,
      },
      cashBaseline: cashOption,
      awardSearch: {
        provider: awards.provider,
        searchType: awards.searchType,
        warnings: awards.warnings,
        candidatesEvaluated: awards.roundTripPairs.length,
      },
      awardOptions: awardOptions.slice(0, 30),
      acquisitionPromotions: relevantPromotions,
      aviosSubscriptionFeasibility:
        awardOptions.some((o) => o.awardSource === "qatar")
          ? subscriptionFeasibility(
              Math.min(
                ...awardOptions
                  .filter((o) => o.awardSource === "qatar")
                  .map((o) => Number(o.milesRequired))
              ),
              new Date().toISOString().slice(0, 10),
              outboundDate
            )
          : [],
      bestExecutable,
      rule:
        "Lowest executable cash cost wins. Never buy points from a stale, segment-only, unpriced or tax-unknown award candidate.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
