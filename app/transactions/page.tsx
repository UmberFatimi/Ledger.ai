import { requireCurrentUserForPage } from "@/lib/session";
import { listTransactionsForUser } from "@/lib/services/transactions";
import { TransactionsList } from "@/components/TransactionsList";

export default async function TransactionsPage() {
  const user = await requireCurrentUserForPage();

  const transactions = await listTransactionsForUser(user.id, 100);

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Click a category badge to correct it. The correction is remembered — a future transaction
        with a similar description skips the AI call and uses your correction directly.
      </p>
      <TransactionsList initialTransactions={transactions} currentUserId={user.id} />
    </div>
  );
}
