export type SubscriptionPlan = {
  program: string;
  name: string;
  annualAvios: number;
  monthlyDelivery: number;
  publicPrice: number | null;
  currency: string;
  priceVerification: "OFFICIAL" | "SECONDARY_VERIFY_CHECKOUT" | "LOGIN_REQUIRED";
  sourceUrl: string;
};

export const BA_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    program: "british_airways",
    name: "Voyager",
    annualAvios: 20000,
    monthlyDelivery: 1667,
    publicPrice: null,
    currency: "ACCOUNT_CURRENCY",
    priceVerification: "LOGIN_REQUIRED",
    sourceUrl: "https://www.avios.com/en-GB/collect-avios/buy",
  },
  {
    program: "british_airways",
    name: "Traveller",
    annualAvios: 50000,
    monthlyDelivery: 4167,
    publicPrice: null,
    currency: "ACCOUNT_CURRENCY",
    priceVerification: "LOGIN_REQUIRED",
    sourceUrl: "https://www.avios.com/en-GB/collect-avios/buy",
  },
  {
    program: "british_airways",
    name: "Explorer",
    annualAvios: 100000,
    monthlyDelivery: 8334,
    publicPrice: null,
    currency: "ACCOUNT_CURRENCY",
    priceVerification: "LOGIN_REQUIRED",
    sourceUrl: "https://www.avios.com/en-GB/collect-avios/buy",
  },
  {
    program: "british_airways",
    name: "Adventurer",
    annualAvios: 200000,
    monthlyDelivery: 16667,
    publicPrice: null,
    currency: "ACCOUNT_CURRENCY",
    priceVerification: "LOGIN_REQUIRED",
    sourceUrl: "https://www.avios.com/en-GB/collect-avios/buy",
  },
];

function monthlyDropsAvailable(startDate: string, neededBy: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${neededBy}T23:59:59Z`);
  if (end < start) return 0;

  let drops = 1; // initial subscription allocation at/near sign-up
  const cursor = new Date(start);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor <= end) {
    drops += 1;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return drops;
}

export function subscriptionFeasibility(
  targetAvios: number,
  startDate: string,
  neededBy: string
) {
  const drops = monthlyDropsAvailable(startDate, neededBy);
  return BA_SUBSCRIPTION_PLANS.map((plan) => {
    const maxDelivered = Math.min(plan.annualAvios, plan.monthlyDelivery * drops);
    return {
      ...plan,
      dropsAvailable: drops,
      maxDeliveredByNeededDate: maxDelivered,
      sufficientByNeededDate: maxDelivered >= targetAvios,
      note:
        maxDelivered >= targetAvios
          ? "Quantity could be delivered by the needed date, subject to account eligibility and checkout terms."
          : "Subscription is too slow for this redemption date even if the first monthly allocation posts immediately.",
    };
  });
}
