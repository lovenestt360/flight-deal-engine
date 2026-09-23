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
  notes: string[];
  sourceUrl: string;
  verifiedAt: string;
};

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
      "British Airways Club and Qatar Airways Privilege Club accounts must be linked.",
      "Personal details must match across both accounts.",
      "Transfers can move in either direction and are free.",
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
    notes: [
      "British Airways Club and Qatar Airways Privilege Club accounts must be linked.",
      "Personal details must match across both accounts.",
    ],
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
      "Finnair Plus and British Airways Club accounts must be linked.",
      "Two-factor authentication is required on both accounts.",
      "First name and family name must match.",
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
    notes: [
      "Finnair Plus and British Airways Club accounts must be linked.",
      "Two-factor authentication is required on both accounts.",
    ],
    sourceUrl: "https://www.finnair.com/en/finnair-plus/buy--transfer-or-exchange-avios/transfer-avios-between-loyalty-programmes",
    verifiedAt: "2026-09-23",
  },
  ...["iberia","aerclub","vueling","loganair"].flatMap((program) => ([
    {
      from: program,
      to: "british_airways",
      ratioFrom: 1,
      ratioTo: 1,
      fee: 0,
      feeCurrency: null,
      expectedTime: "usually instant",
      samePersonRequired: true,
      minAccountAgeDays: 30,
      notes: [
        "Accounts must be eligible for Avios account linking.",
        "Personal details must match.",
      ],
      sourceUrl: "https://www.avios.com/en-GB/help/my-account",
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
      minAccountAgeDays: 30,
      notes: [
        "Accounts must be eligible for Avios account linking.",
        "Personal details must match.",
      ],
      sourceUrl: "https://www.avios.com/en-GB/help/my-account",
      verifiedAt: "2026-09-23",
    }
  ])),
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
      "ALL and Qatar Airways Privilege Club accounts must be linked.",
      "Minimum conversion is 2,000 ALL Reward points.",
      "Transfer is irreversible.",
    ],
    sourceUrl: "https://www.qatarairways.com/en/Privilege-Club/terms-and-conditions/accor-account-linking.html",
    verifiedAt: "2026-09-23",
  },
];

export type TransferPath = {
  from: string;
  to: string;
  sourceUnitsRequired: number;
  destinationUnitsReceived: number;
  hops: TransferEdge[];
  executable: boolean;
  blockers: string[];
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
  };
  return aliases[key] ?? key;
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

  type State = {
    node: string;
    factor: number; // destination units per 1 source unit
    hops: TransferEdge[];
    visited: Set<string>;
  };

  const queue: State[] = [{ node: from, factor: 1, hops: [], visited: new Set([from]) }];

  while (queue.length) {
    const state = queue.shift()!;
    if (state.hops.length > maxHops) continue;

    if (state.node === to && state.hops.length > 0) {
      const sourceUnitsRequired = Math.ceil(destinationUnitsNeeded / state.factor);
      const blockers = state.hops.flatMap((edge) => {
        const b: string[] = [];
        if (edge.samePersonRequired) b.push(`${edge.from}→${edge.to}: accounts must belong to the same person`);
        if (edge.minAccountAgeDays) b.push(`${edge.from}→${edge.to}: account-link eligibility may require ${edge.minAccountAgeDays} days`);
        return b;
      });
      results.push({
        from,
        to,
        sourceUnitsRequired,
        destinationUnitsReceived: Math.floor(sourceUnitsRequired * state.factor),
        hops: state.hops,
        executable: blockers.length === 0,
        blockers,
      });
      continue;
    }

    if (state.hops.length === maxHops) continue;

    for (const edge of TRANSFER_EDGES.filter((e) => e.from === state.node)) {
      if (state.visited.has(edge.to)) continue;
      const nextFactor = state.factor * (edge.ratioTo / edge.ratioFrom);
      const visited = new Set(state.visited);
      visited.add(edge.to);
      queue.push({
        node: edge.to,
        factor: nextFactor,
        hops: [...state.hops, edge],
        visited,
      });
    }
  }

  return results
    .sort((a,b) => a.sourceUnitsRequired - b.sourceUnitsRequired || a.hops.length - b.hops.length)
    .slice(0, 20);
}

export function transferableSourcesFor(targetRaw: string) {
  const target = normalizeProgram(targetRaw);
  const sources = new Set<string>();
  for (const edge of TRANSFER_EDGES) {
    if (edge.to === target) sources.add(edge.from);
  }
  return Array.from(sources);
}
