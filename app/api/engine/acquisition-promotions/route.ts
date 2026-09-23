import { NextRequest, NextResponse } from "next/server";
import { activeAcquisitionPromotions } from "@/lib/acquisitionPromotions";
import { subscriptionFeasibility } from "@/lib/subscriptionPricing";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const targetAvios = Number(q.get("targetAvios") ?? 0);
  const startDate = q.get("startDate") ?? new Date().toISOString().slice(0, 10);
  const neededBy = q.get("neededBy") ?? startDate;

  return NextResponse.json({
    promotions: activeAcquisitionPromotions(new Date(`${startDate}T12:00:00Z`)),
    subscriptions:
      targetAvios > 0
        ? subscriptionFeasibility(targetAvios, startDate, neededBy)
        : [],
    rule:
      "Promotions and subscriptions are only ranked when eligibility, delivery timing and final checkout price are compatible with the award.",
  });
}
