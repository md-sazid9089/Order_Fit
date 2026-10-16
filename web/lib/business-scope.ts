// Pure helpers for selecting the active business. No browser or network access.
export type MembershipLike = { business_id: string };

/** Pick the business from the URL, then the remembered choice, then the first membership. Only authorized ids qualify. */
export function resolveBusinessId(memberships: readonly MembershipLike[], requested?: string | null, remembered?: string | null): string {
  for (const candidate of [requested, remembered]) {
    if (candidate && memberships.some(m => m.business_id === candidate)) return candidate;
  }
  return memberships[0]?.business_id ?? "";
}

// Routes that are meaningful for any business. Deal-specific routes belong to one business and cannot be reused.
const BUSINESS_LEVEL = new Set(["/deals", "/deals/new", "/deals/sources", "/deals/customers", "/cash-flow", "/payees", "/audit-log", "/users", "/useraccess", "/settings", "/admin", "/financing", "/risk-constraints"]);

/** Where to send the user after switching business, always carrying the new business scope. */
export function pathForBusiness(pathname: string, businessId: string): string {
  const base = BUSINESS_LEVEL.has(pathname) ? pathname : "/deals";
  return `${base}?businessId=${encodeURIComponent(businessId)}`;
}
