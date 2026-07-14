import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { executeTransfer } from "../lib/services/transfer";
import { hashPassword } from "../lib/password";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const DEMO_PASSWORD = "Password123!";

const DEMO_USERS = [
  { name: "Alice Johnson", email: "alice@example.com", startingBalanceCents: 500_000 },
  { name: "Bob Smith", email: "bob@example.com", startingBalanceCents: 400_000 },
  { name: "Carol Diaz", email: "carol@example.com", startingBalanceCents: 700_000 },
  { name: "Dave Chen", email: "dave@example.com", startingBalanceCents: 300_000 },
  { name: "Eve Martinez", email: "eve@example.com", startingBalanceCents: 900_000 },
];

const SEED_TRANSFERS: Array<{
  from: string;
  to: string;
  amountCents: number;
  description: string;
  monthsAgo: 0 | 1;
}> = [
  { from: "alice@example.com", to: "bob@example.com", amountCents: 6500, description: "Whole Foods Market grocery run", monthsAgo: 1 },
  { from: "alice@example.com", to: "carol@example.com", amountCents: 1450, description: "Uber ride downtown", monthsAgo: 1 },
  { from: "bob@example.com", to: "dave@example.com", amountCents: 12000, description: "Electric bill payment", monthsAgo: 1 },
  { from: "carol@example.com", to: "eve@example.com", amountCents: 8999, description: "Amazon purchase - headphones", monthsAgo: 1 },
  { from: "dave@example.com", to: "alice@example.com", amountCents: 1599, description: "Netflix subscription", monthsAgo: 1 },
  { from: "eve@example.com", to: "bob@example.com", amountCents: 250000, description: "Monthly salary payment", monthsAgo: 1 },
  { from: "alice@example.com", to: "dave@example.com", amountCents: 4200, description: "Chipotle lunch order", monthsAgo: 1 },
  { from: "bob@example.com", to: "carol@example.com", amountCents: 3000, description: "Gas station fill-up", monthsAgo: 1 },

  { from: "alice@example.com", to: "bob@example.com", amountCents: 7200, description: "Trader Joe's grocery run", monthsAgo: 0 },
  { from: "alice@example.com", to: "carol@example.com", amountCents: 1850, description: "Lyft ride to airport", monthsAgo: 0 },
  { from: "bob@example.com", to: "dave@example.com", amountCents: 13500, description: "Internet & cable bill", monthsAgo: 0 },
  { from: "carol@example.com", to: "eve@example.com", amountCents: 15999, description: "Amazon purchase - desk lamp", monthsAgo: 0 },
  { from: "dave@example.com", to: "alice@example.com", amountCents: 1599, description: "Netflix subscription", monthsAgo: 0 },
  { from: "eve@example.com", to: "bob@example.com", amountCents: 260000, description: "Monthly salary payment", monthsAgo: 0 },
  { from: "alice@example.com", to: "eve@example.com", amountCents: 5400, description: "Movie tickets - AMC theater", monthsAgo: 0 },
  { from: "carol@example.com", to: "dave@example.com", amountCents: 9000, description: "Spotify family plan", monthsAgo: 0 },
  { from: "bob@example.com", to: "alice@example.com", amountCents: 2200, description: "Starbucks coffee", monthsAgo: 0 },
];

async function main() {
  console.log("Warming up database connection...");
  await prisma.$queryRaw`SELECT 1`;

  console.log("Clearing existing data...");
  await prisma.$transaction(
    [
      prisma.transactionEntry.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.categoryCorrection.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ],
    { maxWait: 10_000, timeout: 15_000 }
  );

  console.log("Creating demo users and accounts...");
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD);
  const usersByEmail = new Map<string, { id: string }>();
  for (const demoUser of DEMO_USERS) {
    const user = await prisma.user.create({
      data: {
        name: demoUser.name,
        email: demoUser.email,
        passwordHash: demoPasswordHash,
        account: { create: { balanceCents: demoUser.startingBalanceCents } },
      },
    });
    usersByEmail.set(demoUser.email, user);
    console.log(`  ${demoUser.name} <${demoUser.email}> — starting balance ${(demoUser.startingBalanceCents / 100).toFixed(2)}`);
  }

  const accountsByEmail = new Map<string, { id: string }>();
  for (const [email, user] of usersByEmail) {
    const account = await prisma.account.findUniqueOrThrow({ where: { userId: user.id } });
    accountsByEmail.set(email, account);
  }

  console.log(`Seeding ${SEED_TRANSFERS.length} historical transfers (each goes through the real transfer + categorization pipeline)...`);
  const backdatedTransactionIds: string[] = [];

  for (const [index, seedTransfer] of SEED_TRANSFERS.entries()) {
    const sender = usersByEmail.get(seedTransfer.from)!;
    const receiverAccount = accountsByEmail.get(seedTransfer.to)!;

    const { transaction } = await executeTransfer({
      senderUserId: sender.id,
      receiverAccountId: receiverAccount.id,
      amountCents: seedTransfer.amountCents,
      description: seedTransfer.description,
      idempotencyKey: `seed-${randomUUID()}`,
    });

    if (seedTransfer.monthsAgo === 1) {
      backdatedTransactionIds.push(transaction.id);
    }

    console.log(
      `  [${index + 1}/${SEED_TRANSFERS.length}] ${seedTransfer.from} -> ${seedTransfer.to}: "${seedTransfer.description}" categorized as ${transaction.category ?? "(pending)"}`
    );

    await sleep(400);
  }

  if (backdatedTransactionIds.length > 0) {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    await prisma.transaction.updateMany({
      where: { id: { in: backdatedTransactionIds } },
      data: { createdAt: lastMonth },
    });
    console.log(`Backdated ${backdatedTransactionIds.length} transactions to last month, so month-over-month insight has two months to compare.`);
  }

  console.log("Seed complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
