/**
 * Expense claim categories → GL expense accounts + UI meta.
 * Shared by the expenses API (live auto-post) and the GL backfill so both
 * flows derive the exact same ledger lines for the same claim items.
 */

// Category → GL expense account. Fallback = 5140 Administrative Expenses.
export const CATEGORY_ACCOUNT: Record<string, string> = {
  TRAVEL: "5120",
  FUEL: "5120",
  FOOD: "5140",
  STATIONERY: "5140",
  MARKETING: "5130",
  REPAIR: "5100",
  UTILITY: "5090",
  QUALITY: "5060",
  TOOLING: "5040",
  SUBCONTRACT: "5030",
  TRAINING: "5140",
  OTHER: "5140",
};

export const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  TRAVEL: { label: "Travel", cls: "bg-sky-500/10 text-sky-400" },
  FUEL: { label: "Fuel", cls: "bg-amber-500/10 text-amber-400" },
  FOOD: { label: "Food & Dining", cls: "bg-orange-500/10 text-orange-400" },
  STATIONERY: { label: "Stationery", cls: "bg-slate-500/10 text-slate-300" },
  MARKETING: { label: "Marketing", cls: "bg-purple-500/10 text-purple-400" },
  REPAIR: { label: "Repairs", cls: "bg-rose-500/10 text-rose-400" },
  UTILITY: { label: "Utilities", cls: "bg-teal-500/10 text-teal-400" },
  QUALITY: { label: "Quality", cls: "bg-emerald-500/10 text-emerald-400" },
  TOOLING: { label: "Tooling", cls: "bg-indigo-500/10 text-indigo-400" },
  SUBCONTRACT: { label: "Subcontract", cls: "bg-cyan-500/10 text-cyan-400" },
  TRAINING: { label: "Training", cls: "bg-lime-500/10 text-lime-400" },
  OTHER: { label: "Other", cls: "bg-slate-500/10 text-slate-400" },
};

/** Resolve the GL expense account for a claim item category. */
export function accountForCategory(category: string | null | undefined): string {
  return CATEGORY_ACCOUNT[String(category || "OTHER").toUpperCase()] || "5140";
}