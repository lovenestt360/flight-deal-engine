import { NextRequest, NextResponse } from "next/server";
import { cheapestAcquisitionRoutes } from "@/lib/acquisitionOptimizer";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const targetProgram = q.get("targetProgram") ?? "";
  const miles = Number(q.get("miles") ?? 0);

  if (!targetProgram || !Number.isFinite(miles) || miles <= 0) {
    return NextResponse.json(
      { error: "targetProgram and positive miles are required" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    targetProgram,
    miles,
    acquisitionRoutes: cheapestAcquisitionRoutes(targetProgram, miles),
    note:
      "This compares direct purchase with transferable-source paths. Unknown prices remain unknown rather than being guessed.",
  });
}
