import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { signSessionJWT, verifySessionJWT, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/jwt";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();

  const payload = await verifySessionJWT(token);
  if (!payload) return NextResponse.next();

  const refreshed = await signSessionJWT(payload.userId);
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, refreshed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
