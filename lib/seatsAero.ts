const BASE_URL = "https://seats.aero/partnerapi";

type SearchParams = {
  origin: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  cabin?: "economy" | "premium" | "business" | "first";
  sources?: string[];
  carriers?: string[];
  take?: number;
  includeTrips?: boolean;
  orderBy?: "lowest_mileage";
};

function getApiKey() {
  const key = process.env.SEATS_AERO_API_KEY;
  if (!key) throw new Error("SEATS_AERO_API_KEY is not configured");
  return key;
}

async function seatsFetch(path: string, searchParams?: URLSearchParams) {
  const url = new URL(`${BASE_URL}${path}`);
  if (searchParams) url.search = searchParams.toString();

  const response = await fetch(url, {
    headers: {
      "Partner-Authorization": getApiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }

  if (!response.ok) {
    throw new Error(`Seats.aero ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

export async function searchCachedAwards(params: SearchParams) {
  const q = new URLSearchParams({
    origin_airport: params.origin.toUpperCase(),
    destination_airport: params.destination.toUpperCase(),
    cabins: params.cabin ?? "economy",
    take: String(Math.min(Math.max(params.take ?? 100, 10), 1000)),
    include_trips: String(params.includeTrips ?? true),
    minify_trips: "true",
    min_cabin_pct: "100",
  });

  if (params.startDate) q.set("start_date", params.startDate);
  if (params.endDate) q.set("end_date", params.endDate);
  if (params.sources?.length) q.set("sources", params.sources.join(","));
  if (params.carriers?.length) q.set("carriers", params.carriers.join(","));
  if (params.orderBy) q.set("order_by", params.orderBy);

  return seatsFetch("/search", q);
}

export async function getAwardTrips(id: string) {
  return seatsFetch(`/trips/${encodeURIComponent(id)}`, new URLSearchParams({ min_cabin_pct: "100" }));
}
