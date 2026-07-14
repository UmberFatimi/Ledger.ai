import { prisma } from "../prisma";
import { getAccountForUser } from "./accounts";
import { CATEGORY_LABELS } from "../categories";
import type { Category } from "../generated/prisma/client";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function startOfPreviousMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

export async function getTopSpendingCategories(userId: string) {
  const account = await getAccountForUser(userId);
  const now = new Date();

  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      senderAccountId: account.id,
      status: "COMPLETED",
      createdAt: { gte: startOfMonth(now), lt: startOfNextMonth(now) },
    },
    _sum: { amountCents: true },
    orderBy: { _sum: { amountCents: "desc" } },
  });

  return rows.map((row) => ({
    category: row.category ?? "OTHER",
    label: CATEGORY_LABELS[(row.category ?? "OTHER") as Category],
    totalCents: row._sum.amountCents ?? 0,
  }));
}

export async function getMonthOverMonthChange(userId: string) {
  const account = await getAccountForUser(userId);
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = startOfNextMonth(now);
  const lastMonthStart = startOfPreviousMonth(now);

  const [thisMonth, lastMonth] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        senderAccountId: account.id,
        status: "COMPLETED",
        createdAt: { gte: thisMonthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: {
        senderAccountId: account.id,
        status: "COMPLETED",
        createdAt: { gte: lastMonthStart, lt: thisMonthStart },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const currentCents = thisMonth._sum.amountCents ?? 0;
  const previousCents = lastMonth._sum.amountCents ?? 0;
  const changeCents = currentCents - previousCents;
  const changePercent = previousCents === 0 ? null : (changeCents / previousCents) * 100;

  return { currentCents, previousCents, changeCents, changePercent };
}

export async function getMonthlySummary(userId: string) {
  const account = await getAccountForUser(userId);
  const now = new Date();
  const from = startOfMonth(now);
  const to = startOfNextMonth(now);

  const [income, spend] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        receiverAccountId: account.id,
        status: "COMPLETED",
        createdAt: { gte: from, lt: to },
      },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: {
        senderAccountId: account.id,
        status: "COMPLETED",
        createdAt: { gte: from, lt: to },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const incomeCents = income._sum.amountCents ?? 0;
  const spendCents = spend._sum.amountCents ?? 0;

  return { incomeCents, spendCents, netCents: incomeCents - spendCents };
}

export async function getInsights(userId: string) {
  const [topCategories, monthOverMonth, monthlySummary] = await Promise.all([
    getTopSpendingCategories(userId),
    getMonthOverMonthChange(userId),
    getMonthlySummary(userId),
  ]);
  return { topCategories, monthOverMonth, monthlySummary };
}
