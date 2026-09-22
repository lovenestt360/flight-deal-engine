import { getAwardTrips, searchCachedAwards } from "@/lib/seatsAero";

export type Cabin = "economy" | "premium" | "business" | "first";

type AnyObject = Record<string, any>;

type RouteCandidate = {
  direction: "outbound" | "return";
  program: string;
  source: string;
  routeType: "direct" | "constructed_one_stop";
  origin: string;
  destination: string;
  hub?: string;
  miles: number;
  taxes: {
    known: boolean;
    amount: number | null;
    currency: string | null;
  };
  seats: {
    remaining: number | null;
    reliable: boolean;
  };
  flights: Array<{
    flightNumbers: string;
    carriers: string;
    origin: string;
    destination: string;
    departsAt: string;
    arrivesAt: string;
    miles: number;
    remainingSeats: number | null;
    aircraft: string[];
  }>;
  layoverMinutes?: number;
  cachedUpdatedAt: string | null;
  cacheAgeHours: number | null;
  verificationStatus: "CACHED_RECENT" | "STALE_REFRESH_RECOMMENDED" | "UNKNOWN";
  ticketingNote: string;
};

const PROGRAM_NAMES: Record<string, string> = {
  qatar: "Qatar Airways Privilege Club",
  american: "American AAdvantage",
  alaska: "Alaska Mileage Plan",
  velocity: "Virgin Australia Velocity",
  aeroplan: "Air Canada Aeroplan",
  united: "United MileagePlus",
  emirates: "Emirates Skywards",
  etihad: "Etihad Guest",
  ethiopian: "Ethiopian ShebaMiles",
  turkish: "Turkish Miles&Smiles",
  singapore: "Singapore KrisFlyer",
  flyingblue: "Air France-KLM Flying Blue",
  qantas: "Qantas Frequent Flyer",
  finnair: "Finnair Plus",
  lufthansa: "Lufthansa Miles & More",
  smiles: "GOL Smiles",
  virginatlantic: "Virgin Atlantic Flying Club",
};

const TAXES_UNAVAILABLE = new Set(["qatar", "turkish", "singapore"]);
const SEAT_COUNT_UNRELIABLE = new Set(["qatar", "american", "emirates", "qantas", "turkish", "singapore"]);

const CABIN_PREFIX: Record<Cabin, "Y" | "W" | "J" | "F"> = {
  economy: "Y",
  premium: "W",
  business: "J",
  first: "F",
};

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function unwrapData(value: unknown): AnyObject[] {
  const obj = value as AnyObject;
  return Array.isArray(obj?.data) ? obj.data : [];
}

function routeIs(a: AnyObject, origin: string, destination: string) {
  return a?.Route?.OriginAirport === origin && a?.Route?.DestinationAirport === destination;
}

function availabilityMiles(a: AnyObject, cabin: Cabin) {
  const p = CABIN_PREFIX[cabin];
  const raw = a?.[`${p}MileageCostRaw`] ?? a?.[`${p}MileageCost`];
  const miles = Number(raw ?? 0);
  return Number.isFinite(miles) ? miles : 0;
}

function availabilityAvailable(a: AnyObject, cabin: Cabin) {
  const p = CABIN_PREFIX[cabin];
  return Boolean(a?.[`${p}Available`]) && availabilityMiles(a, cabin) > 0;
}

function sourceOf(a: AnyObject) {
  return String(a?.Source ?? a?.Route?.Source ?? "").toLowerCase();
}

function bestBySource(items: AnyObject[], cabin: Cabin) {
  const map = new Map<string, AnyObject>();
  for (const item of items) {
    if (!availabilityAvailable(item, cabin)) continue;
    const source = sourceOf(item);
    if (!source) continue;
    const existing = map.get(source);
    if (!existing || availabilityMiles(item, cabin) < availabilityMiles(existing, cabin)) {
      map.set(source, item);
    }
  }
  return map;
}

function tripList(value: unknown, cabin: Cabin): AnyObject[] {
  return unwrapData(value)
    .filter((t) => String(t?.Cabin ?? "").toLowerCase() === cabin)
    .filter((t) => Number(t?.MileageCost ?? 0) > 0);
}

function parseLocalLikeTimestamp(ts: string) {
  // Seats.aero documents these timestamp strings as airport-local times even
  // though they include a Z suffix. Comparing two timestamps at the same hub
  // remains valid because both are expressed in the same hub-local clock.
  return Date.parse(ts);
}

function connectionMinutes(first: AnyObject, second: AnyObject) {
  const a = parseLocalLikeTimestamp(String(first?.ArrivesAt ?? ""));
  const b = parseLocalLikeTimestamp(String(second?.DepartsAt ?? ""));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function newestVerificationStatus(updatedAt: string | null) {
  if (!updatedAt) return { ageHours: null, status: "UNKNOWN" as const };
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return { ageHours: null, status: "UNKNOWN" as const };
  const ageHours = Math.max(0, (Date.now() - t) / 3600000);
  return {
    ageHours: Number(ageHours.toFixed(1)),
    status: ageHours <= 3 ? ("CACHED_RECENT" as const) : ("STALE_REFRESH_RECOMMENDED" as const),
  };
}

function oldestUpdatedAt(...items: AnyObject[]) {
  const times = items
    .map((x) => String(x?.UpdatedAt ?? ""))
    .filter(Boolean)
    .map((x) => ({ raw: x, ms: Date.parse(x) }))
    .filter((x) => Number.isFinite(x.ms))
    .sort((a, b) => a.ms - b.ms);
  return times[0]?.raw ?? null;
}

function tripTaxes(source: string, trips: AnyObject[]) {
  if (TAXES_UNAVAILABLE.has(source)) {
    return { known: false, amount: null, currency: null };
  }

  const currencies = new Set(
    trips.map((t) => String(t?.TaxesCurrency ?? "")).filter(Boolean)
  );
  if (currencies.size !== 1) {
    return { known: false, amount: null, currency: null };
  }

  const cents = trips.reduce((sum, t) => sum + Number(t?.TotalTaxes ?? 0), 0);
  return {
    known: true,
    amount: Number((cents / 100).toFixed(2)),
    currency: Array.from(currencies)[0],
  };
}

function seatsFor(source: string, trips: AnyObject[]) {
  const values = trips
    .map((t) => Number(t?.RemainingSeats ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    remaining: values.length ? Math.min(...values) : null,
    reliable: !SEAT_COUNT_UNRELIABLE.has(source),
  };
}

function flightSummary(t: AnyObject) {
  return {
    flightNumbers: String(t?.FlightNumbers ?? ""),
    carriers: String(t?.Carriers ?? ""),
    origin: String(t?.OriginAirport ?? ""),
    destination: String(t?.DestinationAirport ?? ""),
    departsAt: String(t?.DepartsAt ?? ""),
    arrivesAt: String(t?.ArrivesAt ?? ""),
    miles: Number(t?.MileageCost ?? 0),
    remainingSeats: Number(t?.RemainingSeats ?? 0) > 0 ? Number(t.RemainingSeats) : null,
    aircraft: Array.isArray(t?.Aircraft) ? t.Aircraft.map(String) : [],
  };
}

async function directCandidates(
  direction: "outbound" | "return",
  availability: AnyObject[],
  origin: string,
  destination: string,
  cabin: Cabin,
  maxPrograms = 5
): Promise<RouteCandidate[]> {
  const bySource = bestBySource(
    availability.filter((a) => routeIs(a, origin, destination)),
    cabin
  );

  const pairs = Array.from(bySource.entries())
    .sort((a, b) => availabilityMiles(a[1], cabin) - availabilityMiles(b[1], cabin))
    .slice(0, maxPrograms);

  const output: RouteCandidate[] = [];

  for (const [source, a] of pairs) {
    const details = await getAwardTrips(String(a.ID));
    const trips = tripList(details, cabin)
      .sort((x, y) => Number(x.MileageCost) - Number(y.MileageCost));

    for (const trip of trips.slice(0, 3)) {
      const updatedAt = oldestUpdatedAt(a, trip);
      const freshness = newestVerificationStatus(updatedAt);
      output.push({
        direction,
        program: PROGRAM_NAMES[source] ?? source,
        source,
        routeType: "direct",
        origin,
        destination,
        miles: Number(trip.MileageCost),
        taxes: tripTaxes(source, [trip]),
        seats: seatsFor(source, [trip]),
        flights: [flightSummary(trip)],
        cachedUpdatedAt: updatedAt,
        cacheAgeHours: freshness.ageHours,
        verificationStatus: freshness.status,
        ticketingNote:
          freshness.status === "CACHED_RECENT"
            ? "Cached award data is recent, but final redemption pricing should still be confirmed before purchasing points."
            : "Cached availability is stale. Refresh or confirm the award before purchasing points.",
      });
    }
  }

  return output;
}

async function hubCandidates(
  direction: "outbound" | "return",
  availability: AnyObject[],
  origin: string,
  destination: string,
  hub: string,
  cabin: Cabin,
  minLayoverMinutes: number,
  maxLayoverMinutes: number,
  maxPrograms = 4
): Promise<RouteCandidate[]> {
  const firstBySource = bestBySource(
    availability.filter((a) => routeIs(a, origin, hub)),
    cabin
  );
  const secondBySource = bestBySource(
    availability.filter((a) => routeIs(a, hub, destination)),
    cabin
  );

  const common = Array.from(firstBySource.keys())
    .filter((source) => secondBySource.has(source))
    .map((source) => {
      const a = firstBySource.get(source)!;
      const b = secondBySource.get(source)!;
      return { source, a, b, miles: availabilityMiles(a, cabin) + availabilityMiles(b, cabin) };
    })
    .sort((x, y) => x.miles - y.miles)
    .slice(0, maxPrograms);

  const output: RouteCandidate[] = [];

  for (const pair of common) {
    const [firstDetails, secondDetails] = await Promise.all([
      getAwardTrips(String(pair.a.ID)),
      getAwardTrips(String(pair.b.ID)),
    ]);

    const firstTrips = tripList(firstDetails, cabin);
    const secondTrips = tripList(secondDetails, cabin);
    const valid: Array<{ first: AnyObject; second: AnyObject; layover: number; miles: number }> = [];

    for (const first of firstTrips) {
      for (const second of secondTrips) {
        if (String(first.DestinationAirport) !== hub || String(second.OriginAirport) !== hub) continue;
        const layover = connectionMinutes(first, second);
        if (layover === null || layover < minLayoverMinutes || layover > maxLayoverMinutes) continue;
        valid.push({
          first,
          second,
          layover,
          miles: Number(first.MileageCost) + Number(second.MileageCost),
        });
      }
    }

    valid.sort((x, y) => x.miles - y.miles || x.layover - y.layover);

    for (const v of valid.slice(0, 3)) {
      const updatedAt = oldestUpdatedAt(pair.a, pair.b, v.first, v.second);
      const freshness = newestVerificationStatus(updatedAt);
      output.push({
        direction,
        program: PROGRAM_NAMES[pair.source] ?? pair.source,
        source: pair.source,
        routeType: "constructed_one_stop",
        origin,
        destination,
        hub,
        miles: v.miles,
        taxes: tripTaxes(pair.source, [v.first, v.second]),
        seats: seatsFor(pair.source, [v.first, v.second]),
        flights: [flightSummary(v.first), flightSummary(v.second)],
        layoverMinutes: v.layover,
        cachedUpdatedAt: updatedAt,
        cacheAgeHours: freshness.ageHours,
        verificationStatus: freshness.status,
        ticketingNote:
          "This is a constructed connection from two award segments. It may price as separate awards; confirm through-pricing, baggage handling and connection protection before buying points.",
      });
    }
  }

  return output;
}

async function searchDirection(options: {
  direction: "outbound" | "return";
  origin: string;
  destination: string;
  date: string;
  hubs: string[];
  cabin: Cabin;
  minLayoverMinutes: number;
  maxLayoverMinutes: number;
}) {
  const { direction, origin, destination, date, hubs, cabin, minLayoverMinutes, maxLayoverMinutes } = options;
  const origins = Array.from(new Set([origin, ...hubs]));
  const destinations = Array.from(new Set([destination, ...hubs]));

  const raw = await searchCachedAwards({
    origin: origins.join(","),
    destination: destinations.join(","),
    startDate: date,
    endDate: addDays(date, 2),
    cabin,
    take: 1000,
    includeTrips: false,
    orderBy: "lowest_mileage",
  });

  const availability = unwrapData(raw);

  const direct = await directCandidates(
    direction,
    availability,
    origin,
    destination,
    cabin
  );

  const viaHub: RouteCandidate[] = [];
  for (const hub of hubs) {
    const found = await hubCandidates(
      direction,
      availability,
      origin,
      destination,
      hub,
      cabin,
      minLayoverMinutes,
      maxLayoverMinutes
    );
    viaHub.push(...found);
  }

  const candidates = [...direct, ...viaHub].sort(
    (a, b) => a.miles - b.miles || (a.layoverMinutes ?? 0) - (b.layoverMinutes ?? 0)
  );

  return {
    date,
    searchedThrough: addDays(date, 2),
    cachedAvailabilityObjects: availability.length,
    candidates,
  };
}

export async function searchRoundTripAwardRoutes(options: {
  origin: string;
  destination: string;
  outboundDate: string;
  returnDate?: string;
  hubs: string[];
  cabin: Cabin;
  minLayoverMinutes?: number;
  maxLayoverMinutes?: number;
}) {
  const minLayoverMinutes = options.minLayoverMinutes ?? 60;
  const maxLayoverMinutes = options.maxLayoverMinutes ?? 36 * 60;

  const outbound = await searchDirection({
    direction: "outbound",
    origin: options.origin,
    destination: options.destination,
    date: options.outboundDate,
    hubs: options.hubs,
    cabin: options.cabin,
    minLayoverMinutes,
    maxLayoverMinutes,
  });

  const inbound = options.returnDate
    ? await searchDirection({
        direction: "return",
        origin: options.destination,
        destination: options.origin,
        date: options.returnDate,
        hubs: options.hubs,
        cabin: options.cabin,
        minLayoverMinutes,
        maxLayoverMinutes,
      })
    : null;

  const roundTripPairs: AnyObject[] = [];
  if (inbound) {
    for (const out of outbound.candidates.slice(0, 20)) {
      for (const back of inbound.candidates.slice(0, 20)) {
        if (out.source !== back.source) continue;
        roundTripPairs.push({
          program: out.program,
          source: out.source,
          miles: out.miles + back.miles,
          taxes:
            out.taxes.known &&
            back.taxes.known &&
            out.taxes.currency === back.taxes.currency
              ? {
                  known: true,
                  amount: Number(((out.taxes.amount ?? 0) + (back.taxes.amount ?? 0)).toFixed(2)),
                  currency: out.taxes.currency,
                }
              : { known: false, amount: null, currency: null },
          outbound: out,
          return: back,
          verificationStatus:
            out.verificationStatus === "CACHED_RECENT" &&
            back.verificationStatus === "CACHED_RECENT"
              ? "CACHED_RECENT"
              : "STALE_REFRESH_RECOMMENDED",
          doNotBuyPointsYet:
            out.verificationStatus !== "CACHED_RECENT" ||
            back.verificationStatus !== "CACHED_RECENT" ||
            !out.taxes.known ||
            !back.taxes.known,
        });
      }
    }

    roundTripPairs.sort((a, b) => Number(a.miles) - Number(b.miles));
  }

  return {
    provider: "Seats.aero",
    searchType: "cached",
    cabin: options.cabin,
    hubs: options.hubs,
    connectionRules: {
      minLayoverMinutes,
      maxLayoverMinutes,
    },
    outbound,
    return: inbound,
    roundTripPairs: roundTripPairs.slice(0, 20),
    warnings: [
      "Cached availability can be stale. Do not buy points until the selected award is refreshed or confirmed.",
      "Constructed one-stop candidates combine segment-level awards and may not through-price as one award.",
      "Seats.aero does not provide taxes/surcharges for Qatar Privilege Club, Turkish Miles&Smiles or KrisFlyer cached results.",
    ],
  };
}
