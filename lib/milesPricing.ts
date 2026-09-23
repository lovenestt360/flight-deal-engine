export type AcquisitionQuote = {
  program: string;
  currency: string;
  milesRequested: number;
  purchasable: boolean;
  requiresExistingBalance: boolean;
  minimumExistingBalance: number;
  purchaseCost: number | null;
  purchasePlan?: Array<{ miles: number; price: number }>;
  note: string;
  verifiedAt: string;
  sourceUrl: string;
};

const VELOCITY_TIERS = [
  [1000,36],[1500,51],[2000,68],[2500,85],[3000,101],[3500,118],[4000,135],[4500,152],
  [5000,168],[6000,201],[7000,233],[8000,264],[9000,296],[10000,325],[11000,353],
  [12000,375],[13000,399],[14000,427],[15000,452],[16000,469],[17000,492],[18000,512],
  [19000,535],[20000,555],[21000,580],[22000,605],[23000,629],[24000,653],[25000,677],
  [26000,698],[27000,720],[28000,743],[29000,765],[30000,787],[35000,894],[40000,994],
  [45000,1086],[50000,1172],[60000,1404],[70000,1638],[80000,1872],[90000,2106],
  [100000,2340],[150000,3510],[200000,4680],[250000,5850],
] as const;

function velocityPlan(target: number) {
  // Unbounded knapsack on 500-point units to find the cheapest published
  // combination that purchases at least the requested number of points.
  const unit = 500;
  const max = Math.ceil((target + 100000) / unit);
  const inf = Number.POSITIVE_INFINITY;
  const dp = Array(max + 1).fill(inf);
  const prev: Array<{ from: number; miles: number; price: number } | null> = Array(max + 1).fill(null);
  dp[0] = 0;

  for (let i = 0; i <= max; i++) {
    if (!Number.isFinite(dp[i])) continue;
    for (const [miles, price] of VELOCITY_TIERS) {
      const j = i + Math.round(miles / unit);
      if (j <= max && dp[i] + price < dp[j]) {
        dp[j] = dp[i] + price;
        prev[j] = { from: i, miles, price };
      }
    }
  }

  const start = Math.ceil(target / unit);
  let best = start;
  for (let i = start; i <= max; i++) {
    if (dp[i] < dp[best]) best = i;
  }

  if (!Number.isFinite(dp[best])) return null;
  const plan: Array<{ miles: number; price: number }> = [];
  let cursor = best;
  while (cursor > 0 && prev[cursor]) {
    const p = prev[cursor]!;
    plan.push({ miles: p.miles, price: p.price });
    cursor = p.from;
  }
  return {
    pointsPurchased: plan.reduce((s, x) => s + x.miles, 0),
    cost: dp[best],
    plan,
  };
}

export function quoteMilesPurchase(program: string, miles: number): AcquisitionQuote {
  const source = program.toLowerCase();

  if (source === "american" || source === "aadvantage") {
    // Official public AA pricing is a range. Use the published minimum only as
    // a LOWER BOUND. Exact checkout pricing can be higher.
    const base = miles * 0.023;
    const cost = base * 1.075;
    return {
      program: "American AAdvantage",
      currency: "USD",
      milesRequested: miles,
      purchasable: miles <= 300000,
      requiresExistingBalance: false,
      minimumExistingBalance: 0,
      purchaseCost: Number(cost.toFixed(2)),
      note: "Lower-bound estimate using AA's published minimum $0.023/mile plus 7.5% federal excise tax. Exact purchase price may be higher.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.aa.com/i18n/customer-service/support/optional-service-fees.html",
    };
  }

  if (source === "velocity") {
    const q = velocityPlan(miles);
    return {
      program: "Virgin Australia Velocity",
      currency: "AUD",
      milesRequested: miles,
      purchasable: Boolean(q) && miles <= 250000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: q ? Number(q.cost.toFixed(2)) : null,
      purchasePlan: q?.plan,
      note: q
        ? `Cheapest combination of the currently published Points Booster tiers buys ${q.pointsPurchased.toLocaleString()} points. Member must already hold at least 1 Velocity Point.`
        : "Unable to construct a purchase plan from published tiers.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.velocityfrequentflyer.com/the-basics/buying-points",
    };
  }

  if (source === "qatar" || source === "qatar privilege club") {
    return {
      program: "Qatar Airways Privilege Club",
      currency: "USD",
      milesRequested: miles,
      purchasable: miles <= 250000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: null,
      note: "Qatar does not publish a static public purchase price; the price depends on quantity and is shown after login. Member must have earned at least 1 Avios since enrolment before buying additional Avios.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.qatarairways.com/en/Privilege-Club/buy-gift-transfer.html",
    };
  }

  return {
    program,
    currency: "USD",
    milesRequested: miles,
    purchasable: false,
    requiresExistingBalance: false,
    minimumExistingBalance: 0,
    purchaseCost: null,
    note: "No verified acquisition-price rule is configured for this program yet.",
    verifiedAt: "2026-09-23",
    sourceUrl: "",
  };
}
