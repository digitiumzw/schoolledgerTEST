/**
 * System (hard-coded) payment categories.
 *
 * Feature: 057-payment-billing-ux
 *
 * These three categories are always supplied by the backend via
 * GET /api/settings/payment-categories with `system: true`. The frontend
 * should render them distinctly (lock icon, badge) and disable edit/delete
 * actions. They cannot be created, renamed, or deleted.
 */

export interface SystemPaymentCategory {
  id:     string;
  name:   string;
  system: true;
}

export const SYSTEM_PAYMENT_CATEGORIES: readonly SystemPaymentCategory[] = [
  { id: "__fees",            name: "Fees",             system: true },
  { id: "__transport",       name: "Transport",        system: true },
  { id: "__transport_fees",  name: "Transport + Fees", system: true },
] as const;

const SYSTEM_IDS   = new Set(SYSTEM_PAYMENT_CATEGORIES.map((c) => c.id));
const SYSTEM_NAMES = new Set(
  SYSTEM_PAYMENT_CATEGORIES.map((c) => c.name.toLowerCase().trim())
);

/** True when the given payment category ID is a system category. */
export function isSystemCategoryId(id: string | null | undefined): boolean {
  return !!id && SYSTEM_IDS.has(id);
}

/** True when the given name matches a system category name (case-insensitive). */
export function isSystemCategoryName(name: string | null | undefined): boolean {
  return !!name && SYSTEM_NAMES.has(name.toLowerCase().trim());
}
