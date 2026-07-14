import Link from "next/link";
import { requireCurrentUserForPage } from "@/lib/session";
import { getAccountForUser } from "@/lib/services/accounts";
import { getInsights } from "@/lib/services/insights";
import { listTransactionsForUser } from "@/lib/services/transactions";
import { formatCents } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/categories";
import { TransactionRow } from "@/components/TransactionRow";
import { AnimatedNumber } from "@/components/AnimatedNumber";

export default async function DashboardPage() {
  const user = await requireCurrentUserForPage();

  const [account, insights, recentTransactions] = await Promise.all([
    getAccountForUser(user.id),
    getInsights(user.id),
    listTransactionsForUser(user.id, 5),
  ]);

  const { monthlySummary, monthOverMonth, topCategories } = insights;

  return (
    <div className="stagger-children flex flex-col gap-8">
      <section className="rounded-xl border border-black/10 bg-white p-6 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Your balance</div>
        <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
          <AnimatedNumber cents={account.balanceCents} />
        </div>
        <div className="mt-4 flex gap-3">
          <Link
            href="/transfer"
            className="rounded-md border border-[#3cc4a9] px-3 py-1.5 bg-[#3cc4a9] text-black
             hover:bg-[#248673] hover:text-white hover:scale-[1.03] active:scale-[0.97] shadow-md hover:shadow-lg
             transition-all duration-150"
          >
            Send Money
          </Link>
          <Link
            href="/transactions"
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:scale-[1.02] hover:bg-black/5 active:scale-[0.97] dark:border-white/10 dark:hover:bg-white/10"
          >
            View transactions
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Insights this month</h2>
        <div className="stagger-children mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-black/10 bg-white p-4 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Income vs spend</div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">In</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCents(monthlySummary.incomeCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Out</span>
                <span className="tabular-nums text-red-600 dark:text-red-400">
                  {formatCents(monthlySummary.spendCents)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-black/10 pt-1 font-medium dark:border-white/10">
                <span>Net</span>
                <span className="tabular-nums">{formatCents(monthlySummary.netCents)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-4 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Spend vs last month</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">
              {formatCents(monthOverMonth.currentCents)}
            </div>
            <div className="mt-1 text-sm">
              {monthOverMonth.changePercent === null ? (
                <span className="text-zinc-500 dark:text-zinc-400">No prior month data</span>
              ) : (
                <span
                  className={
                    monthOverMonth.changeCents <= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {monthOverMonth.changeCents >= 0 ? "+" : ""}
                  {monthOverMonth.changePercent.toFixed(1)}% vs {formatCents(monthOverMonth.previousCents)}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-4 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Top spending categories</div>
            <div className="mt-2 flex flex-col gap-1.5 text-sm">
              {topCategories.length === 0 && (
                <span className="text-zinc-500 dark:text-zinc-400">No spending yet this month</span>
              )}
              {topCategories.slice(0, 4).map((c) => (
                <div key={c.category} className="flex justify-between">
                  <span>{CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] ?? c.label}</span>
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatCents(c.totalCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Recent activity</h2>
          <Link href="/transactions" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            View all
          </Link>
        </div>
        <div className="stagger-children mt-3 divide-y divide-black/10 rounded-xl border border-black/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-zinc-950">
          {recentTransactions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No transactions yet.
            </div>
          )}
          {recentTransactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} currentUserId={user.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
