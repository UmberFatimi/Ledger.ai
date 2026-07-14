import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { UnauthorizedError } from "./errors";
import { signSessionJWT, verifySessionJWT, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./jwt";
import type { User } from "./generated/prisma/client";

export async function createSession(userId: string): Promise<void> {
  const token = await signSessionJWT(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionJWT(token);
  if (!payload) return null;

  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Log in first");
  return user;
}

export async function requireCurrentUserForPage(): Promise<User> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    redirect("/login");
  }

  const payload = await verifySessionJWT(token);
  if (!payload) {
    redirect("/login?reason=timeout");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    redirect("/login?reason=timeout");
  }

  return user;
}
