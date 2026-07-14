import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";

export function apiHandler<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status }
        );
      }
      console.error("Unhandled API error:", err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
        { status: 500 }
      );
    }
  };
}
