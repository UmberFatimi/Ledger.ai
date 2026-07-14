import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { parseJsonBody } from "@/lib/validation";
import { ValidationError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { executeTransfer } from "@/lib/services/transfer";

const transferSchema = z.object({
  receiverAccountId: z.string().min(1),
  amountCents: z.number().int().positive(),
  description: z.string().trim().min(1).max(200),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requireCurrentUser();

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    throw new ValidationError("Idempotency-Key header is required");
  }

  const body = await parseJsonBody(req, transferSchema);

  const { transaction, replayed } = await executeTransfer({
    senderUserId: user.id,
    receiverAccountId: body.receiverAccountId,
    amountCents: body.amountCents,
    description: body.description,
    idempotencyKey,
  });

  revalidatePath("/", "layout");

  return NextResponse.json(
    { transaction, replayed },
    {
      status: replayed ? 200 : 201,
      headers: { "Idempotent-Replayed": String(replayed) },
    }
  );
});
