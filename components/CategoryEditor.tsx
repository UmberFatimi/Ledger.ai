"use client";

import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { CategoryBadge } from "./TransactionRow";
import type { TransactionSummary } from "@/lib/types";

export function CategoryEditor({
  transaction,
  onCorrected,
}: {
  transaction: TransactionSummary;
  onCorrected: (updated: TransactionSummary) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 rounded-full transition-transform hover:scale-105 hover:opacity-70 active:scale-95"
        title="Click to correct this category"
      >
        <CategoryBadge category={transaction.category} source={transaction.categorySource} />
      </button>
    );
  }

  async function handleSelect(category: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ transaction: TransactionSummary }>(
        `/api/transactions/${transaction.id}/category`,
        { method: "PATCH", body: JSON.stringify({ category }) }
      );
      onCorrected(res.transaction);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save correction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        autoFocus
        disabled={saving}
        defaultValue={transaction.category ?? ""}
        onChange={(e) => handleSelect(e.target.value)}
        // Guards against onBlur closing this mid-save and hiding an error.
        onBlur={() => {
          if (!saving) setEditing(false);
        }}
        className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-950"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
