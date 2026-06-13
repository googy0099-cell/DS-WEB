// ── Sandbox / "โหมดทดสอบระบบ" ────────────────────────────────────────────────
// Owner can flip the whole app into a test mode where everything they do is
// tagged isTest=true and is hidden from every report / total / notification, and
// can be wiped clean afterwards. The flag lives in a cookie so only the owner's
// own device is in test mode — real staff keep working on live data.

export const TEST_MODE_COOKIE = "ds_test_mode";

// Models that carry an `isTest` column. The Prisma extension auto-tags creates
// and auto-filters list/aggregate reads for exactly these models, and the
// cleanup endpoint wipes exactly these (plus their non-tagged children).
// Keep this list in sync with the schema + the migration + the cleanup route.
export const TAGGED_MODELS = [
  "Order",
  "Bill",
  "Payment",
  "SplitPayment",
  "PlayerSession",
  "Receipt",
  "CashExpense",
  "CashTopup",
  "CashDrawerSession",
] as const;

const TAGGED_SET: Set<string> = new Set(TAGGED_MODELS);
export function isTaggedModel(model: string | undefined): boolean {
  return !!model && TAGGED_SET.has(model);
}

/**
 * Is the current request in test mode? Reads the cookie via next/headers.
 * Returns false in any non-request context (cron jobs, scripts, seed) so those
 * paths always operate on live data — fail-safe.
 */
export async function isTestModeActive(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return store.get(TEST_MODE_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}
