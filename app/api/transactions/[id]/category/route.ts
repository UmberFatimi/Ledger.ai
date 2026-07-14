import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { parseJsonBody } from "@/lib/validation";
import { requireCurrentUser } from "@/lib/session";
import { getTransactionForUser } from "@/lib/services/transactions";
import { correctTransactionCategory } from "@/lib/services/categorization";
import { CATEGORIES } from "@/lib/categories";
import type { Category } from "@/lib/generated/prisma/client";

const correctionSchema = z.object({
  category: z.enum(CATEGORIES as [Category, ...Category[]]),
});

export const PATCH = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCurrentUser();
    const { id } = await ctx.params;

    await getTransactionForUser(id, user.id);

    const body = await parseJsonBody(req, correctionSchema);
    await correctTransactionCategory(id, user.id, body.category);

    const updated = await getTransactionForUser(id, user.id);

    revalidatePath("/", "layout");

    return NextResponse.json({ transaction: updated });
  }
);
