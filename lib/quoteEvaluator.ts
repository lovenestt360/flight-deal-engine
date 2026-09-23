type QuoteObservation = {
  sourceProgram: string;
  sourceUnitsPurchased: number;
  bonusUnits?: number;
  totalPrice: number;
  currency: string;
  observedAt?: string;
  accountCountry?: string;
  promotionName?: string;
};

export function evaluateObservedQuote(options: {
  quote: QuoteObservation;
  targetMilesNeeded: number;
  targetMilesProduced: number;
  awardTaxesUSD: number;
  cashBaselineUSD: number;
  usdPerQuoteCurrency?: number;
}) {
  const q = options.quote;
  const received = q.sourceUnitsPurchased + (q.bonusUnits ?? 0);
  const fx =
    q.currency.toUpperCase() === "USD"
      ? 1
      : options.usdPerQuoteCurrency ?? null;

  const effectivePerReceivedUnit =
    received > 0 ? q.totalPrice / received : null;

  const priceUSD = fx !== null ? q.totalPrice * fx : null;
  const allInUSD =
    priceUSD !== null
      ? Number((priceUSD + options.awardTaxesUSD).toFixed(2))
      : null;

  return {
    quote: q,
    receivedSourceUnits: received,
    effectivePricePerReceivedSourceUnit: effectivePerReceivedUnit,
    targetCoveragePct:
      options.targetMilesNeeded > 0
        ? Number(
            Math.min(
              100,
              (options.targetMilesProduced / options.targetMilesNeeded) * 100
            ).toFixed(2)
          )
        : 0,
    convertedPurchasePriceUSD:
      priceUSD !== null ? Number(priceUSD.toFixed(2)) : null,
    allInAwardCostUSD: allInUSD,
    savingVsCashUSD:
      allInUSD !== null
        ? Number((options.cashBaselineUSD - allInUSD).toFixed(2))
        : null,
    beatsCash:
      allInUSD !== null ? allInUSD < options.cashBaselineUSD : null,
    status:
      fx === null
        ? "FX_REQUIRED"
        : options.targetMilesProduced < options.targetMilesNeeded
          ? "INSUFFICIENT_POINTS"
          : allInUSD !== null && allInUSD < options.cashBaselineUSD
            ? "QUOTE_BEATS_CASH"
            : "QUOTE_DOES_NOT_BEAT_CASH",
  };
}
