export type AcquisitionQuote = {
  program: string;
  currency: string;
  milesRequested: number;
  purchasable: boolean;
  requiresExistingBalance: boolean;
  minimumExistingBalance: number;
  purchaseCost: number | null;
  purchasePlan?: Array<{ miles: number; price: number }>;
  maxPurchasablePerYear?: number;
  postingTime?: string;
  priceStatus?: "VERIFIED_PUBLIC" | "LOGIN_REQUIRED" | "LOWER_BOUND";
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

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function velocityPlan(target: number) {
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
  for (let i = start; i <= max; i++) if (dp[i] < dp[best]) best = i;
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
  const source = normalize(program);

  if (source === "american" || source === "aadvantage" || source === "american_aadvantage") {
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
      maxPurchasablePerYear: 300000,
      priceStatus: "LOWER_BOUND",
      note: "Lower-bound estimate using AA's published minimum $0.023/mile plus 7.5% federal excise tax. Exact checkout pricing can be higher.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.aa.com/i18n/customer-service/support/optional-service-fees.html",
    };
  }

  if (source === "velocity" || source === "virgin_australia_velocity") {
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
      maxPurchasablePerYear: 250000,
      priceStatus: q ? "VERIFIED_PUBLIC" : "LOGIN_REQUIRED",
      note: q
        ? `Cheapest combination of currently published Points Booster tiers buys ${q.pointsPurchased.toLocaleString()} points. Member must already hold at least 1 Velocity Point.`
        : "Unable to construct a purchase plan from the published tiers.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.velocityfrequentflyer.com/the-basics/buying-points",
    };
  }

  if (source === "emirates" || source === "skywards" || source === "emirates_skywards") {
    const roundedMiles = Math.ceil(miles / 1000) * 1000;
    const price = Number(((roundedMiles / 1000) * 30).toFixed(2));
    return {
      program: "Emirates Skywards",
      currency: "USD",
      milesRequested: miles,
      purchasable: roundedMiles <= 100000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: price,
      purchasePlan: [{ miles: roundedMiles, price }],
      maxPurchasablePerYear: 100000,
      priceStatus: "VERIFIED_PUBLIC",
      note: "Blue/Silver members may buy up to 100,000 Skywards Miles per year at USD 30 per 1,000. The account must have eligible earning activity before buying miles.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.emirates.com/us/english/skywards/do-more-with-your-miles/",
    };
  }

  if (source === "qatar" || source === "qatar_privilege_club" || source === "qatar_airways_privilege_club") {
    return {
      program: "Qatar Airways Privilege Club",
      currency: "USD",
      milesRequested: miles,
      purchasable: miles <= 250000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: null,
      maxPurchasablePerYear: 250000,
      priceStatus: "LOGIN_REQUIRED",
      note: "Qatar's exact Buy Avios price is quantity-dependent and shown after login. The member must have earned at least 1 Avios since enrolment before buying additional Avios.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.qatarairways.com/en/Privilege-Club/buy-gift-transfer.html",
    };
  }

  if (["british_airways","ba","british_airways_club"].includes(source)) {
    return {
      program: "British Airways Club",
      currency: "USD",
      milesRequested: miles,
      purchasable: miles <= 200000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: null,
      maxPurchasablePerYear: 200000,
      postingTime: "usually immediate; allow up to 36 hours / 3 working days",
      priceStatus: "LOGIN_REQUIRED",
      note: "BA allows up to 200,000 Avios purchases per calendar year. Exact price is shown in the Buy Avios checkout and depends on account country. A zero-balance account must previously have collected or redeemed at least 1 Avios within the last 36 months.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.avios.com/en-GB/help/buying-avios",
    };
  }

  if (source === "finnair" || source === "finnair_plus") {
    return {
      program: "Finnair Plus",
      currency: "EUR",
      milesRequested: miles,
      purchasable: miles <= 200000,
      requiresExistingBalance: false,
      minimumExistingBalance: 0,
      purchaseCost: null,
      maxPurchasablePerYear: 200000,
      postingTime: "1–3 days after purchase",
      priceStatus: "LOGIN_REQUIRED",
      note: "Finnair permits up to 200,000 Avios bought or received as a gift per calendar year. Exact Buy Avios pricing is visible after login.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.finnair.com/en/finnair-plus/buy--transfer-or-exchange-avios",
    };
  }

  if (source === "iberia" || source === "iberia_club" || source === "iberia_plus") {
    return {
      program: "Iberia Club",
      currency: "EUR",
      milesRequested: miles,
      purchasable: miles <= 200000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: null,
      maxPurchasablePerYear: 200000,
      priceStatus: "LOGIN_REQUIRED",
      note: "Iberia Club members can buy Avios, but the current quantity price is shown inside the member purchase flow. General Avios eligibility requires at least 1 Avios or prior collect/redeem activity when the balance is zero.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.iberia.com/es/iberia-club/buy-gift-avios/",
    };
  }

  if (source === "aerclub" || source === "aer_lingus" || source === "aer_lingus_aerclub") {
    return {
      program: "Aer Lingus AerClub",
      currency: "USD",
      milesRequested: miles,
      purchasable: miles <= 200000,
      requiresExistingBalance: true,
      minimumExistingBalance: 1,
      purchaseCost: null,
      maxPurchasablePerYear: 200000,
      priceStatus: "LOGIN_REQUIRED",
      note: "AerClub uses the Avios Buy/Boost platform. Exact price is account-specific; a zero-balance account must have prior eligible Avios activity.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.avios.com/en-GB/help/buying-avios",
    };
  }

  if (source === "marriott_bonvoy" || source === "marriott") {
    return {
      program: "Marriott Bonvoy",
      currency: "USD",
      milesRequested: miles,
      purchasable: miles <= 100000,
      requiresExistingBalance: false,
      minimumExistingBalance: 0,
      purchaseCost: null,
      maxPurchasablePerYear: 100000,
      priceStatus: "LOGIN_REQUIRED",
      note: "Marriott permits buying up to 100,000 Bonvoy points per calendar year. Exact purchase price/promotions are shown in the points purchase flow. Airline conversions are a separate step.",
      verifiedAt: "2026-09-23",
      sourceUrl: "https://www.marriott.com/loyalty/redeem/buyPoints1.mi",
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
    priceStatus: "LOGIN_REQUIRED",
    note: "No verified acquisition-price rule is configured for this program yet.",
    verifiedAt: "2026-09-23",
    sourceUrl: "",
  };
}
