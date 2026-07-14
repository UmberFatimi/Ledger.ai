import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { parseJsonBody } from "@/lib/validation";
import { loginWithPassword } from "@/lib/services/auth";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const { email, password } = await parseJsonBody(req, loginSchema);
  const user = await loginWithPassword(email, password);

  revalidatePath("/", "layout");

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
});
