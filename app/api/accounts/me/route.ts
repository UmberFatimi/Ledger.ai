import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { requireCurrentUser } from "@/lib/session";
import { getAccountForUser } from "@/lib/services/accounts";

export const GET = apiHandler(async (_req: NextRequest) => {
  const user = await requireCurrentUser();
  const account = await getAccountForUser(user.id);
  return NextResponse.json({ account });
});
