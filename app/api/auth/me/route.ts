import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { getCurrentUser } from "@/lib/session";

export const GET = apiHandler(async (_req: NextRequest) => {
  const user = await getCurrentUser();
  return NextResponse.json({
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
  });
});
