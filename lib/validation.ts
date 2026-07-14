import { NextRequest } from "next/server";
import { ZodType } from "zod";
import { ValidationError } from "./errors";

export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodType<T>
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ValidationError("Invalid request body", result.error.flatten());
  }
  return result.data;
}
