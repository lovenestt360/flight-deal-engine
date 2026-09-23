import { cheapestAcquisitionRoutes } from "@/lib/acquisitionOptimizer";
import { activeAcquisitionPromotions } from "@/lib/acquisitionPromotions";

export type AccountMode = "new" | "existing_unknown";

export type MilesMarketInput = {
  targetProgram: string;
  targetMiles: number;
  cashBaselineUSD: number;
  awardTaxesUSD?: number;
  accountMode?: AccountMode;
};

type Eligibility = {
  status:
    | "IMMEDIATE"
    | "LOGIN_REQUIRED"
    | "EARN_FIRST"
    | "WAIT_REQUIRED"
    | "PROMO_NOT_ELIGIBLE"
    | "LIMIT_EXCEEDED"
    | "UNKNOWN";
  waitDays?: number;
  requirements: string[];
};

const ELIGIBILITY: Record<string, {
  newMember: Eligibility;
  existingUnknown: Eligibility;
}> = {
  qatar: {
    newMember: {
      status: "EARN_FIRST",
      requirements: [
        "A new Qatar Privilege Club member must have earned at least 1 Avios since enrolment before buying additional Avios.",
      ],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm the member has at least one eligible earned Avios and is within the annual purchase cap."],
    },
  },
  british_airways: {
    newMember: {
      status: "EARN_FIRST",
      requirements: [
        "A zero-balance BA Club member must previously have collected or redeemed at least 1 Avios within the last three years before buying Avios.",
      ],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm Buy Avios eligibility in the member account."],
    },
  },
  iberia: {
    newMember: {
      status: "EARN_FIRST",
      requirements: [
        "Iberia Club uses the common Avios eligibility rule: a zero-balance member needs prior eligible Avios activity before buying.",
      ],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm Buy Avios eligibility and checkout price."],
    },
  },
  aerclub: {
    newMember: {
      status: "EARN_FIRST",
      requirements: [
        "AerClub uses the common Avios eligibility rule: a zero-balance member needs prior eligible Avios activity before buying.",
      ],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm Buy Avios eligibility and checkout price."],
    },
  },
  finnair: {
    newMember: {
      status: "LOGIN_REQUIRED",
      requirements: [
        "Finnair publishes no general minimum balance requirement for ordinary Buy Avios, but the exact price is only shown after login.",
        "The current up-to-50% bonus promotion is NOT available to a new member joining now.",
      ],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm current Buy Avios price and any account-specific bonus rate after login."],
    },
  },
  marriott_bonvoy: {
    newMember: {
      status: "WAIT_REQUIRED",
      waitDays: 30,
      requirements: ["A new Marriott Bonvoy member may buy points 30 days after enrolment."],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm account is in good standing and within the annual purchase cap."],
    },
  },
  american: {
    newMember: {
      status: "LOGIN_REQUIRED",
      requirements: ["Exact checkout pricing and purchase eligibility must be confirmed in the AAdvantage account."],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm exact checkout pricing and annual purchase capacity."],
    },
  },
  emirates: {
    newMember: {
      status: "EARN_FIRST",
      requirements: ["Skywards requires eligible earning activity before a member can buy miles."],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm eligible earning activity exists and the annual cap is available."],
    },
  },
  velocity: {
    newMember: {
      status: "EARN_FIRST",
      requirements: ["The member must already hold at least 1 Velocity Point before buying Points Booster points."],
    },
    existingUnknown: {
      status: "LOGIN_REQUIRED",
      requirements: ["Confirm the member has at least 1 Velocity Point and available annual capacity."],
    },
  },
};

function normalizeProgram(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function getEligibility(program: string, accountMode: AccountMode): Eligibility {
  const key = normalizeProgram(program);
  const rule = ELIGIBILITY[key];
  if (!rule) {
    return {
      status: "UNKNOWN",
      requirements: ["No new-member acquisition eligibility rule is configured for this source yet."],
    };
  }
  return accountMode === "new" ? rule.newMember : rule.existingUnknown;
}

export function buildMilesAcquisitionMarket(input: MilesMarketInput) {
  const accountMode = input.accountMode ?? "new";
  const taxes = Math.max(0, input.awardTaxesUSD ?? 0);
  const acquisitionBudgetUSD = Number(
    Math.max(0, input.cashBaselineUSD - taxes).toFixed(2)
  );

  const candidates = cheapestAcquisitionRoutes(
    input.targetProgram,
    input.targetMiles
  );

  const routes = candidates.map((candidate) => {
    const eligibility = getEligibility(candidate.sourceProgram, accountMode);
    const maxPerSourceUnitUSD =
      candidate.sourceUnitsNeeded > 0
        ? acquisitionBudgetUSD / candidate.sourceUnitsNeeded
        : 0;

    const limitExceeded =
      candidate.maxPurchasablePerYear !== null &&
      candidate.sourceUnitsNeeded > candidate.maxPurchasablePerYear;

    const knownUsdCost =
      candidate.acquisitionCurrency === "USD" &&
      candidate.acquisitionCost !== null
        ? Number(candidate.acquisitionCost)
        : null;

    const allInKnownUSD =
      knownUsdCost !== null ? Number((knownUsdCost + taxes).toFixed(2)) : null;

    const savingVsCashUSD =
      allInKnownUSD !== null
        ? Number((input.cashBaselineUSD - allInKnownUSD).toFixed(2))
        : null;

    const finalEligibility: Eligibility = limitExceeded
      ? {
          status: "LIMIT_EXCEEDED",
          requirements: [
            `Need ${candidate.sourceUnitsNeeded.toLocaleString()} source units, above the configured annual purchase cap of ${candidate.maxPurchasablePerYear?.toLocaleString()}.`,
          ],
        }
      : eligibility;

    return {
      sourceProgram: candidate.sourceProgram,
      targetProgram: candidate.targetProgram,
      sourceUnitsNeeded: candidate.sourceUnitsNeeded,
      targetMilesProduced: input.targetMiles,
      acquisitionCurrency: candidate.acquisitionCurrency,
      quotedPurchaseCost: candidate.acquisitionCost,
      priceStatus: candidate.priceStatus,
      transferHops: candidate.hops,
      transferPath: candidate.path,
      eligibility: finalEligibility,
      breakEven: {
        cashBaselineUSD: input.cashBaselineUSD,
        awardTaxesUSD: taxes,
        maxCashAvailableForMilesUSD: acquisitionBudgetUSD,
        maxEffectiveUSDPerSourceUnit: Number(maxPerSourceUnitUSD.toFixed(6)),
        maxEffectiveUSCentsPerSourceUnit: Number((maxPerSourceUnitUSD * 100).toFixed(4)),
      },
      knownCostComparison:
        allInKnownUSD !== null
          ? {
              acquisitionCostUSD: knownUsdCost,
              allInAwardCostUSD: allInKnownUSD,
              savingVsCashUSD,
              beatsCash: allInKnownUSD < input.cashBaselineUSD,
            }
          : null,
      status:
        limitExceeded
          ? "REJECT"
          : allInKnownUSD !== null
            ? allInKnownUSD < input.cashBaselineUSD
              ? "PRICE_KNOWN_NEEDS_AWARD_CONFIRMATION"
              : "REJECT"
            : finalEligibility.status === "EARN_FIRST" ||
                finalEligibility.status === "WAIT_REQUIRED"
              ? "SETUP_REQUIRED"
              : "LOGIN_PRICE_REQUIRED",
      note: candidate.note,
    };
  });

  const promotions = activeAcquisitionPromotions(new Date());

  const finnairPromo = promotions.find(
    (p) => p.program === "finnair" || p.id.includes("finnair")
  );

  const scenarios = [
    ...(finnairPromo
      ? [{
          program: "finnair",
          type: "MAX_PROMO_SCENARIO",
          maxAdvertisedPurchaseBonusPct: 50,
          baseAviosNeededAtMaxBonus: Math.ceil(input.targetMiles / 1.5),
          executableForNewMember: false,
          reason:
            "The Sep 21–Oct 5, 2026 Finnair promotion requires membership before Sep 18, 2026 and at least 50 Avios, so a new zero-mile passenger cannot use it.",
        }]
      : []),
  ];

  const ranked = [...routes].sort((a, b) => {
    const statusRank: Record<string, number> = {
      PRICE_KNOWN_NEEDS_AWARD_CONFIRMATION: 0,
      LOGIN_PRICE_REQUIRED: 1,
      SETUP_REQUIRED: 2,
      REJECT: 3,
    };
    const sr = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (sr) return sr;

    const ac = a.knownCostComparison?.allInAwardCostUSD ?? Number.POSITIVE_INFINITY;
    const bc = b.knownCostComparison?.allInAwardCostUSD ?? Number.POSITIVE_INFINITY;
    if (ac !== bc) return ac - bc;

    return a.sourceUnitsNeeded - b.sourceUnitsNeeded;
  });

  return {
    targetProgram: input.targetProgram,
    targetMiles: input.targetMiles,
    accountMode,
    cashBaselineUSD: input.cashBaselineUSD,
    awardTaxesUSD: taxes,
    acquisitionBudgetUSD,
    routes: ranked,
    promotionalScenarios: scenarios,
    interpretation: {
      rule:
        "A login-only source remains a candidate only if its eventual checkout price is below the break-even price shown for that source.",
      example:
        "If maxEffectiveUSCentsPerSourceUnit is 1.05, paying more than 1.05 US cents per source point cannot beat the supplied cash fare before any unmodelled fees.",
    },
  };
}
