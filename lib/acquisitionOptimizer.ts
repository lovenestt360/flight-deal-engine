import { quoteMilesPurchase } from "@/lib/milesPricing";
import { findTransferPaths } from "@/lib/transferGraph";

type Candidate = {
  sourceProgram: string;
  targetProgram: string;
  targetMilesNeeded: number;
  sourceUnitsNeeded: number;
  acquisitionCurrency: string;
  acquisitionCost: number | null;
  hops: number;
  path: ReturnType<typeof findTransferPaths>[number] | null;
  note: string;
};

const BUYABLE_SOURCES = [
  "qatar",
  "british_airways",
  "finnair",
  "iberia",
  "aerclub",
  "velocity",
  "american",
  "emirates",
];

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
    hops: 0,
    path: null,
    note: direct.note,
  });

  for (const source of BUYABLE_SOURCES) {
    if (source === targetProgram) continue;
    const paths = findTransferPaths(source, targetProgram, targetMilesNeeded, 3);
    for (const path of paths.slice(0, 3)) {
      const quote = quoteMilesPurchase(source, path.sourceUnitsRequired);
      candidates.push({
        sourceProgram: source,
        targetProgram,
        targetMilesNeeded,
        sourceUnitsNeeded: path.sourceUnitsRequired,
        acquisitionCurrency: quote.currency,
        acquisitionCost: quote.purchaseCost,
        hops: path.hops.length,
        path,
        note: quote.note,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (a.acquisitionCost === null && b.acquisitionCost === null) return a.hops - b.hops;
    if (a.acquisitionCost === null) return 1;
    if (b.acquisitionCost === null) return -1;
    if (a.acquisitionCurrency !== b.acquisitionCurrency) return a.hops - b.hops;
    return a.acquisitionCost - b.acquisitionCost;
  });
}
