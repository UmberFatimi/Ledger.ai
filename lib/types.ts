import type { Category, CategorySource, TransactionStatus, EntryDirection } from "./generated/prisma/client";

export interface AccountSummary {
  id: string;
  balanceCents: number;
  userId: string;
  user: { id: string; name: string; email: string };
}

export interface TransactionEntrySummary {
  id: string;
  direction: EntryDirection;
  amountCents: number;
  balanceAfter: number;
  accountId: string;
}

export interface TransactionSummary {
  id: string;
  idempotencyKey: string;
  status: TransactionStatus;
  amountCents: number;
  description: string;
  category: Category | null;
  categorySource: CategorySource | null;
  failureReason: string | null;
  createdAt: string | Date;
  senderAccount: { id: string; user: { id: string; name: string } };
  receiverAccount: { id: string; user: { id: string; name: string } };
  entries?: TransactionEntrySummary[];
}

export interface InsightsResponse {
  topCategories: { category: string; label: string; totalCents: number }[];
  monthOverMonth: {
    currentCents: number;
    previousCents: number;
    changeCents: number;
    changePercent: number | null;
  };
  monthlySummary: { incomeCents: number; spendCents: number; netCents: number };
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}
