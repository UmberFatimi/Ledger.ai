import { prisma } from "../prisma";
import { NotFoundError, UnauthorizedError } from "../errors";
import { getAccountForUser } from "./accounts";

const counterpartySelect = {
  include: { user: { select: { id: true, name: true } } },
} as const;

export async function listTransactionsForUser(userId: string, limit = 100) {
  const account = await getAccountForUser(userId);

  return prisma.transaction.findMany({
    where: {
      OR: [{ senderAccountId: account.id }, { receiverAccountId: account.id }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      senderAccount: counterpartySelect,
      receiverAccount: counterpartySelect,
    },
  });
}

export async function getTransactionForUser(transactionId: string, userId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      senderAccount: counterpartySelect,
      receiverAccount: counterpartySelect,
    },
  });
  if (!transaction) throw new NotFoundError("Transaction not found");

  const isParty =
    transaction.senderAccount.user.id === userId ||
    transaction.receiverAccount.user.id === userId;
  if (!isParty) throw new UnauthorizedError("Not a party to this transaction");

  return transaction;
}
