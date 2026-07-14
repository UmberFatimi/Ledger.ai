import { prisma } from "../prisma";
import { NotFoundError } from "../errors";

export async function getAccountForUser(userId: string) {
  const account = await prisma.account.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!account) throw new NotFoundError("Account not found");
  return account;
}

export async function listOtherAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId: { not: userId } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
}
