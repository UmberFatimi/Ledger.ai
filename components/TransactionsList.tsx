"use client";

import { useState } from "react";
import { TransactionRow } from "./TransactionRow";
import { CategoryEditor } from "./CategoryEditor";
import type { TransactionSummary } from "@/lib/types";

export function TransactionsList({
  initialTransactions,
  currentUserId,
}: {
  initialTransactions: TransactionSummary[];
  currentUserId: string;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);

  function handleCorrected(updated: TransactionSummary) {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <div className="stagger-children mt-6 divide-y divide-black/10 rounded-xl border border-black/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-zinc-950">
      {transactions.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No transactions yet.
        </div>
      )}
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          currentUserId={currentUserId}
          categorySlot={
            <CategoryEditor transaction={transaction} onCorrected={handleCorrected} />
          }
        />
      ))}
    </div>
  );
}
