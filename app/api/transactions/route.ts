import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { requireCurrentUser } from "@/lib/session";
import { listTransactionsForUser } from "@/lib/services/transactions";

export const GET = apiHandler(async (_req: NextRequest) => {
  const user = await requireCurrentUser();
  const transactions = await listTransactionsForUser(user.id);
  return NextResponse.json({ transactions });
});
