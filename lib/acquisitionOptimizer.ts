import { quoteMilesPurchase } from "@/lib/milesPricing";
import { findTransferPaths } from "@/lib/transferGraph";

type Candidate = {
  sourceProgram: string;
  targetProgram: string;
  targetMilesNeeded: number;
  sourceUnitsNeeded: number;
  acquisitionCurrency: string;
  acquisitionCost: number | null;
  acquisitionPurchasable: boolean;
  maxPurchasablePerYear: number | null;
  priceStatus: string | null;
  hops: number;
  path: ReturnType<typeof findTransferPaths>[number] | null;
  status: "PRICE_KNOWN" | "LOGIN_REQUIRED" | "NOT_PURCHASABLE_FROM_ZERO";
  note: string;
};

const BUYABLE_SOURCES = [
  "qatar",
  "british_airways",
  "finnair",
  "iberia",
  "aerclub",
  "marriott_bonvoy",
  "velocity",
  "american",
  "emirates",
];

function candidateStatus(cost: number | null, purchasable: boolean) {
  if (!purchasable) return "NOT_PURCHASABLE_FROM_ZERO" as const;
  if (cost === null) return "LOGIN_REQUIRED" as const;
  return "PRICE_KNOWN" as const;
}

export function cheapestAcquisitionRoutes(
  targetProgram: string,
  targetMilesNeeded: number
): Candidate[] {
  const candidates: Candidate[] = [];

  const direct = quoteMilesPurchase(targetProgram, targetMilesNeeded);
  candidates.push({
    sourceProgram: targetProgram,
    targetProgram,
    targetMilesNeeded,
    sourceUnitsNeeded: targetMilesNeeded,
    acquisitionCurrency: direct.currency,
    acquisitionCost: direct.purchaseCost,
    acquisitionPurchasable: direct.purchasable,
    maxPurchasablePerYear: direct.maxPurchasablePerYear ?? null,
    priceStatus: direct.priceStatus ?? null,
    hops: 0,
    path: null,
    status: candidateStatus(direct.purchaseCost, direct.purchasable),
    note: direct.note,
  });

  for (const source of BUYABLE_SOURCES) {
    if (source === targetProgram) continue;
    for (const path of findTransferPaths(source, targetProgram, targetMilesNeeded, 3).slice(0, 4)) {
      const quote = quoteMilesPurchase(source, path.sourceUnitsRequired);
      candidates.push({
        sourceProgram: source,
        targetProgram,
        targetMilesNeeded,
        sourceUnitsNeeded: path.sourceUnitsRequired,
        acquisitionCurrency: quote.currency,
        acquisitionCost: quote.purchaseCost,
        acquisitionPurchasable: quote.purchasable,
        maxPurchasablePerYear: quote.maxPurchasablePerYear ?? null,
        priceStatus: quote.priceStatus ?? null,
        hops: path.hops.length,
        path,
        status: candidateStatus(quote.purchaseCost, quote.purchasable),
        note: quote.note,
      });
    }
  }

  return candidates.sort((a, b) => {
    const statusRank = { PRICE_KNOWN: 0, LOGIN_REQUIRED: 1, NOT_PURCHASABLE_FROM_ZERO: 2 } as const;
    const sr = statusRank[a.status] - statusRank[b.status];
    if (sr) return sr;
    if (a.acquisitionCost !== null && b.acquisitionCost !== null && a.acquisitionCurrency === b.acquisitionCurrency) {
      return a.acquisitionCost - b.acquisitionCost;
    }
    return a.hops - b.hops || a.sourceUnitsNeeded - b.sourceUnitsNeeded;
  });
}
