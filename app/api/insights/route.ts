import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { requireCurrentUser } from "@/lib/session";
import { getInsights } from "@/lib/services/insights";

export const GET = apiHandler(async (_req: NextRequest) => {
  const user = await requireCurrentUser();
  const insights = await getInsights(user.id);
  return NextResponse.json({ insights });
});
