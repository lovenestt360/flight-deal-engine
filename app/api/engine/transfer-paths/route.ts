import { NextRequest, NextResponse } from "next/server";
import { findTransferPaths } from "@/lib/transferGraph";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const needed = Number(q.get("needed") ?? 0);
  const maxHops = Number(q.get("maxHops") ?? 3);

  if (!from || !to || !Number.isFinite(needed) || needed <= 0) {
    return NextResponse.json(
      { error: "from, to and positive needed are required" },
      { status: 400 }
    );
  }

  const paths = findTransferPaths(
    from,
    to,
    needed,
    Math.max(1, Math.min(maxHops, 4))
  );

  return NextResponse.json({
    from,
    to,
    needed,
    paths,
    rule:
      "A transfer path is only useful if the passenger can legally acquire the source currency and satisfy every account-link, age, identity and transfer condition.",
  });
}
