export type TransferEdge = {
  from: string;
  to: string;
  ratioFrom: number;
  ratioTo: number;
  fee: number;
  feeCurrency: string | null;
  expectedTime: string;
  samePersonRequired: boolean;
  minAccountAgeDays?: number;
  bonusEverySourceUnits?: number;
  bonusDestinationUnits?: number;
  notes: string[];
  sourceUrl: string;
  verifiedAt: string;
};

const AVIOS_LINK_SOURCE = "https://www.avios.com/en-GB/help/my-account";

const aviosLinkEdges: TransferEdge[] = ["iberia","aerclub","vueling"].flatMap((program) => ([
  {
    from: program,
    to: "british_airways",
    ratioFrom: 1,
    ratioTo: 1,
    fee: 0,
    feeCurrency: null,
    expectedTime: "usually instant",
    samePersonRequired: true,
    notes: ["Accounts must be eligible for Avios account linking.", "Personal details must match."],
    sourceUrl: AVIOS_LINK_SOURCE,
    verifiedAt: "2026-09-23",
  },
  {
    from: "british_airways",
    to: program,
    ratioFrom: 1,
    ratioTo: 1,
    fee: 0,
    feeCurrency: null,
    expectedTime: "usually instant",
    samePersonRequired: true,
    notes: ["Accounts must be eligible for Avios account linking.", "Personal details must match."],
    sourceUrl: AVIOS_LINK_SOURCE,
    verifiedAt: "2026-09-23",
  },
]));

const marriottTargets = [
  "qatar","british_airways","iberia","emirates","etihad","ethiopian",
  "turkish","velocity","singapore","flyingblue","qantas","alaska"
];

const marriottEdges: TransferEdge[] = marriottTargets.map((to) => ({
  from: "marriott_bonvoy",
  to,
  ratioFrom: 3,
  ratioTo: 1,
  fee: 0,
  feeCurrency: null,
  expectedTime: "varies by airline; allow several days",
  samePersonRequired: true,
  bonusEverySourceUnits: 60000,
  bonusDestinationUnits: 5000,
  notes: [
    "Marriott Bonvoy points generally transfer to this airline at 3:1.",
    "For eligible airline partners, every 60,000 Bonvoy points transferred in one block receives 5,000 bonus airline miles/Avios.",
    "Do not initiate a transfer until award availability is confirmed because airline transfers are normally irreversible.",
  ],
  sourceUrl: "https://www.marriott.com/en-gb/loyalty/redeem/travel/points-to-miles.mi",
  verifiedAt: "2026-09-23",
}));

export const TRANSFER_EDGES: TransferEdge[] = [
  {
    from: "british_airways",
    to: "qatar",
    ratioFrom: 1,
    ratioTo: 1,
    fee: 0,
    feeCurrency: null,
    expectedTime: "instant",
    samePersonRequired: true,
    minAccountAgeDays: 30,
    notes: [
      "BA Club and Qatar Privilege Club accounts must be linked.",
      "Personal details must match across both accounts.",
      "Movement is free and instant after linking.",
    ],
    sourceUrl: "https://www.qatarairways.com/en/Privilege-Club/terms-and-conditions/avios.html",
    verifiedAt: "2026-09-23",
  },
  {
    from: "qatar",
    to: "british_airways",
    ratioFrom: 1,
    ratioTo: 1,
    fee: 0,
    feeCurrency: null,
    expectedTime: "instant",
    samePersonRequired: true,
    minAccountAgeDays: 30,
    notes: ["BA Club and Qatar Privilege Club accounts must be linked.", "Personal details must match."],
    sourceUrl: "https://www.qatarairways.com/en/Privilege-Club/terms-and-conditions/avios.html",
    verifiedAt: "2026-09-23",
  },
  {
    from: "finnair",
    to: "british_airways",
    ratioFrom: 1,
    ratioTo: 1,
    fee: 0,
    feeCurrency: null,
    expectedTime: "almost instant",
    samePersonRequired: true,
    minAccountAgeDays: 30,
    notes: [
      "Finnair Plus account must be at least 30 days old.",
      "Two-factor authentication is required on both accounts.",
      "Email, first name and family name must match.",
    ],
    sourceUrl: "https://www.finnair.com/en/finnair-plus/buy--transfer-or-exchange-avios/transfer-avios-between-loyalty-programmes",
    verifiedAt: "2026-09-23",
  },
  {
    from: "british_airways",
    to: "finnair",
    ratioFrom: 1,
    ratioTo: 1,
    fee: 0,
    feeCurrency: null,
    expectedTime: "almost instant",
    samePersonRequired: true,
    minAccountAgeDays: 30,
    notes: ["Finnair Plus account must be at least 30 days old.", "Two-factor authentication is required on both accounts."],
    sourceUrl: "https://www.finnair.com/en/finnair-plus/buy--transfer-or-exchange-avios/transfer-avios-between-loyalty-programmes",
    verifiedAt: "2026-09-23",
  },
  ...aviosLinkEdges,
  {
    from: "accor_all",
    to: "qatar",
    ratioFrom: 2000,
    ratioTo: 1000,
    fee: 0,
    feeCurrency: null,
    expectedTime: "up to 6 weeks",
    samePersonRequired: true,
    notes: [
      "ALL and Qatar Privilege Club accounts must be linked.",
      "Minimum conversion is 2,000 ALL Reward points.",
      "Transfer is irreversible.",
    ],
    sourceUrl: "https://www.qatarairways.com/en/Privilege-Club/terms-and-conditions/accor-account-linking.html",
    verifiedAt: "2026-09-23",
  },
  ...marriottEdges,
];

export type TransferPath = {
  from: string;
  to: string;
  sourceUnitsRequired: number;
  destinationUnitsReceived: number;
  hops: TransferEdge[];
  eligibilityStatus: "NO_SPECIAL_WAIT" | "ACCOUNT_CHECK_REQUIRED";
  requirements: string[];
  maximumKnownWaitDays: number;
};

function normalizeProgram(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, string> = {
    ba: "british_airways",
    british_airways_club: "british_airways",
    british_airways_executive_club: "british_airways",
    qatar_airways_privilege_club: "qatar",
    privilege_club: "qatar",
    finnair_plus: "finnair",
    iberia_plus: "iberia",
    iberia_club: "iberia",
    aer_lingus: "aerclub",
    aer_lingus_aerclub: "aerclub",
    all: "accor_all",
    accor: "accor_all",
    accor_all_reward_points: "accor_all",
    marriott: "marriott_bonvoy",
    bonvoy: "marriott_bonvoy",
  };
  return aliases[key] ?? key;
}

function applyEdge(units: number, edge: TransferEdge) {
  const base = Math.floor((units / edge.ratioFrom) * edge.ratioTo);
  const bonus =
    edge.bonusEverySourceUnits && edge.bonusDestinationUnits
      ? Math.floor(units / edge.bonusEverySourceUnits) * edge.bonusDestinationUnits
      : 0;
  return base + bonus;
}

function applyPath(sourceUnits: number, hops: TransferEdge[]) {
  return hops.reduce((units, edge) => applyEdge(units, edge), sourceUnits);
}

function minimumSourceUnits(hops: TransferEdge[], destinationNeeded: number) {
  let low = 0;
  let high = Math.max(destinationNeeded, 1);
  while (applyPath(high, hops) < destinationNeeded && high < 1000000000) high *= 2;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (applyPath(mid, hops) >= destinationNeeded) high = mid;
    else low = mid;
  }
  return high;
}

export function findTransferPaths(
  fromRaw: string,
  toRaw: string,
  destinationUnitsNeeded: number,
  maxHops = 3
): TransferPath[] {
  const from = normalizeProgram(fromRaw);
  const to = normalizeProgram(toRaw);
  const results: TransferPath[] = [];

  type State = { node: string; hops: TransferEdge[]; visited: Set<string> };
  const queue: State[] = [{ node: from, hops: [], visited: new Set([from]) }];

  while (queue.length) {
    const state = queue.shift()!;
    if (state.hops.length > maxHops) continue;

    if (state.node === to && state.hops.length > 0) {
      const sourceUnitsRequired = minimumSourceUnits(state.hops, destinationUnitsNeeded);
      const destinationUnitsReceived = applyPath(sourceUnitsRequired, state.hops);
      const requirements = state.hops.flatMap((edge) => {
        const req: string[] = [];
        if (edge.samePersonRequired) req.push(`${edge.from}→${edge.to}: account names/owner must match`);
        if (edge.minAccountAgeDays) req.push(`${edge.from}→${edge.to}: account-link wait of at least ${edge.minAccountAgeDays} days`);
        return req;
      });
      const maximumKnownWaitDays = Math.max(0, ...state.hops.map((e) => e.minAccountAgeDays ?? 0));

      results.push({
        from,
        to,
        sourceUnitsRequired,
        destinationUnitsReceived,
        hops: state.hops,
        eligibilityStatus: requirements.length ? "ACCOUNT_CHECK_REQUIRED" : "NO_SPECIAL_WAIT",
        requirements,
        maximumKnownWaitDays,
      });
      continue;
    }

    if (state.hops.length === maxHops) continue;

    for (const edge of TRANSFER_EDGES.filter((e) => e.from === state.node)) {
      if (state.visited.has(edge.to)) continue;
      const visited = new Set(state.visited);
      visited.add(edge.to);
      queue.push({ node: edge.to, hops: [...state.hops, edge], visited });
    }
  }

  return results
    .sort((a,b) => a.sourceUnitsRequired - b.sourceUnitsRequired || a.hops.length - b.hops.length)
    .slice(0, 30);
}

export function transferableSourcesFor(targetRaw: string) {
  const target = normalizeProgram(targetRaw);
  return Array.from(new Set(TRANSFER_EDGES.filter((e) => e.to === target).map((e) => e.from)));
}
