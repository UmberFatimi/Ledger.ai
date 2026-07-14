import type { ReactNode } from "react";
import { formatCents } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/categories";

interface TransactionLike {
  id: string;
  description: string;
  amountCents: number;
  category: string | null;
  categorySource: string | null;
  status: string;
  createdAt: Date | string;
  senderAccount: { user: { id: string; name: string } };
  receiverAccount: { user: { id: string; name: string } };
}

export function TransactionRow({
  transaction,
  currentUserId,
  categorySlot,
}: {
  transaction: TransactionLike;
  currentUserId: string;
  categorySlot?: ReactNode;
}) {
  const isSender = transaction.senderAccount.user.id === currentUserId;
  const counterparty = isSender
    ? transaction.receiverAccount.user.name
    : transaction.senderAccount.user.name;
  const amountColor = isSender
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{transaction.description}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {isSender ? `To ${counterparty}` : `From ${counterparty}`} ·{" "}
          {new Date(transaction.createdAt).toLocaleDateString("en-US")}
          {transaction.status === "FAILED" && (
            <span className="ml-2 font-medium text-red-600 dark:text-red-400">Failed</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {categorySlot ?? (
          <CategoryBadge category={transaction.category} source={transaction.categorySource} />
        )}
        <span className={`w-24 text-right text-sm font-medium tabular-nums ${amountColor}`}>
          {isSender ? "-" : "+"}
          {formatCents(transaction.amountCents)}
        </span>
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  LLM: "AI",
  PATTERN_MATCH: "from your correction",
  MANUAL_CORRECTION: "corrected",
  FALLBACK: "fallback",
};

export function CategoryBadge({
  category,
  source,
}: {
  category: string | null;
  source: string | null;
}) {
  if (!category) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        Categorizing…
      </span>
    );
  }
  const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
  return (
    <span
      title={source ? `Categorized ${SOURCE_LABELS[source] ?? source}` : undefined}
      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    >
      {label}
    </span>
  );
}
