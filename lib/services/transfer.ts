import { prisma } from "../prisma";
import { Prisma } from "../generated/prisma/client";
import {
  InsufficientFundsError,
  InvalidTransferError,
  NotFoundError,
} from "../errors";
import { categorizeTransaction } from "./categorization";

export interface TransferInput {
  senderUserId: string;
  receiverAccountId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
}

export interface TransferOutcome {
  transaction: NonNullable<
    Awaited<ReturnType<typeof prisma.transaction.findUnique>>
  > & { entries: Awaited<ReturnType<typeof prisma.transactionEntry.findMany>> };
  replayed: boolean;
}

export async function executeTransfer(input: TransferInput): Promise<TransferOutcome> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new InvalidTransferError("Amount must be a positive whole number of cents");
  }

  const senderAccount = await prisma.account.findUnique({
    where: { userId: input.senderUserId },
  });
  if (!senderAccount) throw new NotFoundError("Sender account not found");

  const receiverAccount = await prisma.account.findUnique({
    where: { id: input.receiverAccountId },
  });
  if (!receiverAccount) throw new NotFoundError("Recipient account not found");

  if (senderAccount.id === receiverAccount.id) {
    throw new InvalidTransferError("Cannot transfer to your own account");
  }

  let transactionId: string;
  let replayed: boolean;
  let shouldCategorize = false;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock both accounts before inserting the Transaction row, as two
        // separate sequential statements in ascending-ID order — see
        // DECISIONS.md for why (both alternatives deadlocked under real
        // concurrency testing).
        const [firstId, secondId] = [senderAccount.id, receiverAccount.id].sort();
        const [firstLocked] = await tx.$queryRaw<{ id: string; balanceCents: number }[]>`
          SELECT "id", "balanceCents" FROM "Account" WHERE "id" = ${firstId} FOR UPDATE
        `;
        const [secondLocked] = await tx.$queryRaw<{ id: string; balanceCents: number }[]>`
          SELECT "id", "balanceCents" FROM "Account" WHERE "id" = ${secondId} FOR UPDATE
        `;
        const lockedRows = [firstLocked, secondLocked];
        const lockedSender = lockedRows.find((row) => row.id === senderAccount.id)!;
        const lockedReceiver = lockedRows.find((row) => row.id === receiverAccount.id)!;

        const created = await tx.transaction.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            status: "PENDING",
            senderAccountId: senderAccount.id,
            receiverAccountId: receiverAccount.id,
            amountCents: input.amountCents,
            description: input.description,
          },
        });

        if (lockedSender.balanceCents < input.amountCents) {
          await tx.transaction.update({
            where: { id: created.id },
            data: { status: "FAILED", failureReason: "INSUFFICIENT_FUNDS" },
          });
          return { transactionId: created.id, failed: true };
        }

        const newSenderBalance = lockedSender.balanceCents - input.amountCents;
        const newReceiverBalance = lockedReceiver.balanceCents + input.amountCents;

        await tx.account.update({
          where: { id: senderAccount.id },
          data: { balanceCents: newSenderBalance },
        });
        await tx.account.update({
          where: { id: receiverAccount.id },
          data: { balanceCents: newReceiverBalance },
        });

        await tx.transactionEntry.create({
          data: {
            transactionId: created.id,
            accountId: senderAccount.id,
            direction: "DEBIT",
            amountCents: input.amountCents,
            balanceAfter: newSenderBalance,
          },
        });
        await tx.transactionEntry.create({
          data: {
            transactionId: created.id,
            accountId: receiverAccount.id,
            direction: "CREDIT",
            amountCents: input.amountCents,
            balanceAfter: newReceiverBalance,
          },
        });

        await tx.transaction.update({
          where: { id: created.id },
          data: { status: "COMPLETED" },
        });

        return { transactionId: created.id, failed: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 15_000,
        timeout: 30_000,
      }
    );

    transactionId = result.transactionId;
    replayed = false;
    shouldCategorize = !result.failed;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (!existing) {
        throw new InvalidTransferError("Could not resolve idempotency key conflict");
      }
      transactionId = existing.id;
      replayed = true;
    } else {
      throw err;
    }
  }

  // Runs after commit (never inside the transaction) and its own errors
  // are swallowed — a categorization failure must never turn a successful
  // transfer into a reported failure.
  if (shouldCategorize) {
    try {
      await categorizeTransaction(
        transactionId,
        input.senderUserId,
        input.description,
        input.amountCents
      );
    } catch (err) {
      console.error(`Categorization failed for transaction ${transactionId}:`, err);
    }
  }

  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { entries: true },
  });

  if (transaction.status === "FAILED") {
    throw new InsufficientFundsError(transaction.failureReason ?? "Transfer failed");
  }

  return { transaction, replayed };
}
