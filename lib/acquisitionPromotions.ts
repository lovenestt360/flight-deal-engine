export type AcquisitionPromotion = {
  id: string;
  program: string;
  method: string;
  activeAsOf: string;
  endsAt: string | null;
  headline: string;
  eligibility: string[];
  exactPriceKnown: boolean;
  notes: string[];
  sourceUrl: string;
};

export const CURRENT_ACQUISITION_PROMOTIONS: AcquisitionPromotion[] = [
  {
    id: "ba-balance-boost-500-sep-2026",
    program: "british_airways",
    method: "balance_boost",
    activeAsOf: "2026-09-23",
    endsAt: null,
    headline: "British Airways/Avios is advertising a limited-time 500% Balance Boost.",
    eligibility: [
      "Only eligible Avios collected within the previous 30 days can be boosted.",
      "Pending Avios cannot be boosted.",
      "Transferred Avios, gifted Avios, Nectar exchanges and previously bought Avios are excluded.",
      "The first 300,000 boosted Avios per calendar year use the cheapest boost pricing tier.",
    ],
    exactPriceKnown: false,
    notes: [
      "The public Avios page currently advertises 500% boost but the exact checkout rate and offer end time are not publicly exposed.",
      "For a passenger starting with zero eligible recent Avios, this is not immediately executable: an eligible earning transaction must post first.",
      "Never create spend purely to trigger a boost unless the all-in cash cost is lower than competing acquisition paths.",
    ],
    sourceUrl: "https://www.avios.com/en-GB/collect-avios/",
  },
  {
    id: "hsbc-uk-avios-20-sep-2026",
    program: "british_airways",
    method: "bank_transfer_bonus",
    activeAsOf: "2026-09-23",
    endsAt: "2026-09-30",
    headline: "20% bonus Avios on eligible HSBC UK Premier rewards transfers.",
    eligibility: [
      "Requires an eligible HSBC Premier / Premier World Elite rewards balance.",
      "Geography and card-product restrictions apply.",
    ],
    exactPriceKnown: true,
    notes: [
      "This is a transfer bonus, not a way to buy transferable bank points from zero.",
      "Exclude by default when the passenger has zero transferable bank points.",
    ],
    sourceUrl: "https://www.avios.com/en-GB/collect-avios/",
  },
];

export function activeAcquisitionPromotions(asOf = new Date()) {
  const stamp = asOf.toISOString().slice(0, 10);
  return CURRENT_ACQUISITION_PROMOTIONS.filter((p) => {
    if (p.activeAsOf > stamp) return false;
    return !p.endsAt || p.endsAt >= stamp;
  });
}
