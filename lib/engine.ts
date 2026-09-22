export type DealStatus = "READY_TO_BOOK" | "LOGIN_REQUIRED" | "DO_NOT_BUY_POINTS_YET" | "REJECT";

export type CashEquivalentInput = {
  milesRequired: number;
  cashTaxesFees: number;
  centsPerMileToAcquire: number;
  extraCash?: number;
};

export function cashEquivalent(input: CashEquivalentInput) {
  const milesCost = input.milesRequired * (input.centsPerMileToAcquire / 100);
  const total = milesCost + input.cashTaxesFees + (input.extraCash ?? 0);
  return {
    milesCost: Number(milesCost.toFixed(2)),
    totalCashCost: Number(total.toFixed(2)),
  };
}

export function classifyAward(options: {
  awardAvailable: boolean;
  exactPriceKnown: boolean;
  publicCashFare?: number;
  totalCashCost?: number;
}): DealStatus {
  if (!options.awardAvailable) return "DO_NOT_BUY_POINTS_YET";
  if (!options.exactPriceKnown) return "LOGIN_REQUIRED";
  if (
    typeof options.publicCashFare === "number" &&
    typeof options.totalCashCost === "number" &&
    options.totalCashCost >= options.publicCashFare
  ) return "REJECT";
  return "READY_TO_BOOK";
}
