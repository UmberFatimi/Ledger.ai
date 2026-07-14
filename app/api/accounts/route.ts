import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { requireCurrentUser } from "@/lib/session";
import { listOtherAccounts } from "@/lib/services/accounts";

export const GET = apiHandler(async (_req: NextRequest) => {
  const user = await requireCurrentUser();
  const accounts = await listOtherAccounts(user.id);
  return NextResponse.json({ accounts });
});
