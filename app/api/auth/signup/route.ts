import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { parseJsonBody } from "@/lib/validation";
import { signUpUser } from "@/lib/services/auth";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const { name, email, password } = await parseJsonBody(req, signupSchema);
  const user = await signUpUser(name, email, password);

  revalidatePath("/", "layout");

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email } },
    { status: 201 }
  );
});
