import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiHandler } from "@/lib/api-handler";
import { logout } from "@/lib/services/auth";

export const POST = apiHandler(async (_req: NextRequest) => {
  await logout();
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
});
