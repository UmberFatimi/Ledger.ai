import { prisma } from "../prisma";
import { Prisma } from "../generated/prisma/client";
import { ConflictError, UnauthorizedError } from "../errors";
import { createSession, destroySession } from "../session";
import { hashPassword, verifyPassword } from "../password";

export async function signUpUser(name: string, email: string, password: string) {
  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash, account: { create: { balanceCents: 0 } } },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("An account with this email already exists");
    }
    throw err;
  }

  await createSession(user.id);
  return user;
}

export async function loginWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError("Invalid email or password");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  await createSession(user.id);
  return user;
}

export async function logout() {
  await destroySession();
}
