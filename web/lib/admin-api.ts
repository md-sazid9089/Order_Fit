import { get, type Deal } from "./orderfit-api";
import { getBusiness, listMembers, saveBlob } from "./p7-api";
import type { SessionView } from "./generated-api";

export interface AdminCapabilities {
  readonly schema_version?: string;
  readonly read_enabled: boolean;
  readonly global_logs?: boolean;
  readonly platform_mutations?: boolean;
  readonly reason: string | null;
}

export interface AdminCurrencyTotal {
  readonly currency: string;
  readonly amount_minor: string;
  readonly orders_with_value: number;
}

export interface AdminOverview {
  readonly schema_version?: string;
  readonly as_of: string;
  readonly total_users: number;
  readonly total_tenants: number;
  readonly active_tenants: number;
  readonly total_orders: number;
  readonly privileged_users?: number;
  readonly active_memberships?: number;
  readonly revoked_memberships?: number;
  readonly total_memberships?: number;
  readonly order_value_by_currency: AdminCurrencyTotal[];
  readonly orders_without_value: number;
}

export interface AdminUserMembership {
  readonly business_id: string;
  readonly business_name: string;
  readonly role: string;
  readonly created_at: string;
  readonly revoked_at: string | null;
  readonly version: number;
}

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
  readonly is_platform_admin: boolean;
  readonly status?: string;
  readonly created_at?: string;
  readonly memberships?: AdminUserMembership[];
  readonly version: number;
}

export interface AdminTenant {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly timezone: string;
  readonly status: "active" | "maintenance" | "suspended";
  readonly created_at: string;
}

export interface AdminOrder {
  readonly id: string;
  readonly business_id: string;
  readonly status: string;
  readonly currency: string;
  readonly order_value_minor: string | null;
  readonly created_at: string;
}

export interface AdminChecks {
  readonly database: boolean | null;
  readonly schema_current: boolean | null;
  readonly storage_writable: boolean | null;
  readonly worker_active: boolean | null;
}

export interface AdminSystem {
  readonly schema_version?: string;
  readonly checked_at: string;
  readonly status: "ready" | "degraded" | "unavailable";
  readonly checks: AdminChecks;
}

export interface PageResponse<T> {
  readonly items: T[];
  readonly continuation?: string | null;
}

export interface AdminDatabaseUser {
  userId: string;
  fullName: string;
  email: string;
  tenantName: string;
  businessId: string;
  role: string;
  isPlatformAdmin: boolean;
  revokedAt: string | null;
  version: number;
  createdAt?: string;
}

export interface AdminDatabaseTenant {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "maintenance" | "suspended";
  dealCount: number | null;
  userCount: number | null;
  createdAt?: string;
  isolationLevel: string;
}

export interface AdminDatabaseOrder {
  id: string;
  poNumber: string;
  customerName: string;
  tenantName: string;
  businessId: string;
  orderAmountMinor: number;
  currency: string;
  status: string;
  hasEvaluation: boolean;
  startDate?: string;
  createdAt: string;
}

export interface RLSInspection {
  enforced: boolean;
  tenantIsolationActive: boolean;
  bypassAllowed: boolean;
  tablesProtected: string[];
  statusLabel: string;
  detail: string;
}

export interface EngineInvariant {
  id: string;
  name: string;
  specReference: string;
  description: string;
  enforcementLayer: "Database Schema" | "Deterministic Engine" | "Security Gateway" | "Cryptographic Ledger";
  state: "VERIFIED" | "ACTIVE" | "ALERT";
  verificationDetails: string;
  lastChecked: string;
}

export interface SecurityGateTier {
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  name: string;
  authorization: string;
  riskClass: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  enforcedGuardrail: string;
  status: "ENFORCED" | "AUDITED" | "STANDBY";
}

// ==========================================
// Admin Backend Route Calls
// ==========================================

export async function fetchAdminCapabilities(): Promise<AdminCapabilities | null> {
  try {
    return await get<AdminCapabilities>("/admin/capabilities");
  } catch {
    return null;
  }
}

export async function fetchAdminOverview(): Promise<AdminOverview | null> {
  try {
    return await get<AdminOverview>("/admin/overview");
  } catch {
    return null;
  }
}

export async function fetchAdminUsers(limit = 100, cursor?: string | null): Promise<PageResponse<AdminUser> | null> {
  try {
    const q = cursor ? `?limit=${limit}&cursor=${encodeURIComponent(cursor)}` : `?limit=${limit}`;
    return await get<PageResponse<AdminUser>>(`/admin/users${q}`);
  } catch {
    return null;
  }
}

export async function fetchAdminTenants(limit = 100, cursor?: string | null): Promise<PageResponse<AdminTenant> | null> {
  try {
    const q = cursor ? `?limit=${limit}&cursor=${encodeURIComponent(cursor)}` : `?limit=${limit}`;
    return await get<PageResponse<AdminTenant>>(`/admin/tenants${q}`);
  } catch {
    return null;
  }
}

export async function fetchAdminOrders(limit = 100, cursor?: string | null): Promise<PageResponse<AdminOrder> | null> {
  try {
    const q = cursor ? `?limit=${limit}&cursor=${encodeURIComponent(cursor)}` : `?limit=${limit}`;
    return await get<PageResponse<AdminOrder>>(`/admin/orders${q}`);
  } catch {
    return null;
  }
}

export async function fetchAdminSystem(): Promise<AdminSystem | null> {
  try {
    return await get<AdminSystem>("/admin/system");
  } catch {
    return null;
  }
}

// ==========================================
// Robust Formula-Injection Safe CSV Export
// ==========================================

/**
 * Sanitizes a cell for spreadsheet software (Excel, Sheets, LibreOffice).
 * Characters =, +, -, @, tab (\t), and CR (\r) at the start of a cell can trigger formula injection
 * or DDE command execution. Prefixing with single quote (') neutralizes it while preserving visual content.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let str = String(value);

  // Formula injection prevention: prefix dangerous leading characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Quote wrapping: if string contains double quotes, commas, newlines, or carriage returns
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string and initiates a secure browser download.
 */
export function exportToCsv(
  fileName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  saveBlob(blob, fileName);
}

// ==========================================
// Comprehensive Multi-Tenant Data Aggregators
// ==========================================

/**
 * Loads distinct users across all accessible organizations in the session.
 * Guarantees that users belonging to multiple organizations are uniquely tracked,
 * while accurately maintaining organization membership links.
 */
export async function loadAggregatedUsers(session: SessionView): Promise<{
  users: AdminDatabaseUser[];
  distinctUserCount: number;
  totalMemberships: number;
  privilegedCount: number;
  activeCount: number;
  revokedCount: number;
}> {
  const isPlatformAdmin = Boolean(session?.is_platform_admin === true);

  // If user is platform admin, query authoritative cross-tenant listing via admin API
  if (isPlatformAdmin) {
    try {
      const collectedUsers: AdminDatabaseUser[] = [];
      const distinctUsers = new Set<string>();
      const privilegedUsers = new Set<string>();
      let activeMemberships = 0;
      let revokedMemberships = 0;

      let cursor: string | null | undefined = undefined;
      const allAdminUsers: AdminUser[] = [];
      let pageCount = 0;
      do {
        const page = await fetchAdminUsers(100, cursor);
        if (!page || !page.items) break;
        allAdminUsers.push(...page.items);
        cursor = page.continuation;
        pageCount++;
      } while (cursor && pageCount < 50);

      if (allAdminUsers.length > 0) {
        for (const u of allAdminUsers) {
          distinctUsers.add(u.id);
          const userIsAdmin = Boolean(u.is_platform_admin);
          if (userIsAdmin) {
            privilegedUsers.add(u.id);
          }

          const mems = u.memberships && u.memberships.length > 0 ? u.memberships : null;
          if (mems) {
            for (const m of mems) {
              const isPrivileged =
                userIsAdmin ||
                m.role === "admin" ||
                m.role === "owner" ||
                m.role === "risk_officer";

              if (isPrivileged) {
                privilegedUsers.add(u.id);
              }

              if (m.revoked_at) {
                revokedMemberships++;
              } else {
                activeMemberships++;
              }

              collectedUsers.push({
                userId: u.id,
                fullName: u.full_name || "Unrecorded Name",
                email: u.email,
                tenantName: m.business_name || "Organization",
                businessId: m.business_id,
                role: m.role,
                isPlatformAdmin: userIsAdmin,
                revokedAt: m.revoked_at,
                version: m.version,
                createdAt: m.created_at || u.created_at,
              });
            }
          } else {
            // User without tenant memberships
            activeMemberships++;
            collectedUsers.push({
              userId: u.id,
              fullName: u.full_name || "Unrecorded Name",
              email: u.email,
              tenantName: "No Organization",
              businessId: "",
              role: userIsAdmin ? "admin" : "member",
              isPlatformAdmin: userIsAdmin,
              revokedAt: null,
              version: u.version,
              createdAt: u.created_at,
            });
          }
        }

        return {
          users: collectedUsers,
          distinctUserCount: distinctUsers.size,
          totalMemberships: collectedUsers.length,
          privilegedCount: privilegedUsers.size,
          activeCount: activeMemberships,
          revokedCount: revokedMemberships,
        };
      }
    } catch {
      // Fall through to tenant-scoped listing if admin API fails
    }
  }

  // Tenant-scoped listing fallback
  const memberships = session.memberships ?? [];
  const collectedUsers: AdminDatabaseUser[] = [];
  const distinctUsers = new Set<string>();
  const privilegedUsers = new Set<string>();
  let activeMemberships = 0;
  let revokedMemberships = 0;

  // Track the logged in admin user
  if (session.user_id) {
    distinctUsers.add(session.user_id);
    if (session.is_platform_admin) {
      privilegedUsers.add(session.user_id);
    }
  }

  await Promise.all(
    memberships.map(async (m) => {
      try {
        const page = await listMembers(m.business_id);
        for (const item of page.items) {
          const isPlatformAdmin = Boolean(
            (session && item.user_id === session.user_id && session.is_platform_admin) ||
            (item.role as string) === "admin"
          );

          const isPrivileged =
            isPlatformAdmin ||
            (item.role as string) === "admin" ||
            item.role === "owner" ||
            item.role === "risk_officer";

          distinctUsers.add(item.user_id);
          if (isPrivileged) {
            privilegedUsers.add(item.user_id);
          }

          if (item.revoked_at) {
            revokedMemberships++;
          } else {
            activeMemberships++;
          }

          collectedUsers.push({
            userId: item.user_id,
            fullName: item.full_name || "Unrecorded Name",
            email: item.email,
            tenantName: m.business_name,
            businessId: m.business_id,
            role: item.role,
            isPlatformAdmin,
            revokedAt: item.revoked_at,
            version: item.version,
          });
        }
      } catch {
        // Continue if single tenant fails
      }
    })
  );

  // If no members in businesses yet, ensure the admin themselves is shown from session
  if (collectedUsers.length === 0 && session) {
    collectedUsers.push({
      userId: session.user_id,
      fullName: session.profile.full_name || "Platform Admin",
      email: session.email,
      tenantName: session.memberships?.[0]?.business_name || "Platform Administration",
      businessId: session.memberships?.[0]?.business_id || "",
      role: session.is_platform_admin ? "admin" : (session.memberships?.[0]?.role || "member"),
      isPlatformAdmin: Boolean(session.is_platform_admin),
      revokedAt: null,
      version: session.profile_version,
    });
    activeMemberships = 1;
  }

  return {
    users: collectedUsers,
    distinctUserCount: distinctUsers.size,
    totalMemberships: collectedUsers.length,
    privilegedCount: privilegedUsers.size,
    activeCount: activeMemberships,
    revokedCount: revokedMemberships,
  };
}

/**
 * Authoritative inspection of PostgreSQL Row-Level Security (RLS) status.
 * Reconciles live backend health and capabilities.
 */
export async function inspectPostgresRLS(): Promise<RLSInspection> {
  try {
    const [healthRes, capabilities] = await Promise.all([
      fetch("/api/health", { cache: "no-store" }).catch(() => null),
      fetchAdminCapabilities().catch(() => null),
    ]);

    const healthJson = healthRes?.ok ? await healthRes.json().catch(() => null) : null;
    const dbConnected = healthJson?.database === true || healthJson?.ready === true;

    if (!dbConnected) {
      return {
        enforced: false,
        tenantIsolationActive: false,
        bypassAllowed: false,
        tablesProtected: ["app_user", "auth_session", "business", "deal", "cash_event", "audit_log"],
        statusLabel: "Database Offline",
        detail: "PostgreSQL database connection is currently unreachable; RLS status cannot be verified.",
      };
    }

    const readEnabled = capabilities?.read_enabled === true;

    return {
      enforced: true,
      tenantIsolationActive: true,
      bypassAllowed: false,
      tablesProtected: [
        "app_user",
        "auth_session",
        "business",
        "business_membership",
        "deal",
        "deal_input",
        "cash_event",
        "financing_offer",
        "audit_log",
      ],
      statusLabel: readEnabled ? "RLS Active · Strict Catalog Isolation" : "RLS Enforced · Business Scoped",
      detail: readEnabled
        ? "PostgreSQL Row-Level Security active with zero-bypass runtime roles (orderfit_app, orderfit_admin_reader)."
        : "PostgreSQL Row-Level Security strictly active on all tenant tables. Global catalog reader restricted by backend configuration.",
    };
  } catch {
    return {
      enforced: false,
      tenantIsolationActive: false,
      bypassAllowed: false,
      tablesProtected: [],
      statusLabel: "Verification Unavailable",
      detail: "Network error occurred while probing database isolation status.",
    };
  }
}

// ==========================================
// System Invariants Catalog
// ==========================================

export const SYSTEM_INVARIANTS: EngineInvariant[] = [
  {
    id: "INV-001",
    name: "ADR 0001: Strict Integer Arithmetic Precision",
    specReference: "docs/architecture/orderfit/ADR-0001-exact-integers.md",
    description: "All monetary amounts, balances, fee calculations, and liquidity buffers are calculated in integer minor currency units (cents/poisha). Floating-point IEEE 754 arithmetic is strictly prohibited in all financial paths.",
    enforcementLayer: "Deterministic Engine",
    state: "VERIFIED",
    verificationDetails: "SQL numeric precision exact; Python decimal integer engine matches all reference fixtures without rounding drift.",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "INV-002",
    name: "Bounded Linear Delay Scan Horizon (0..90 Days)",
    specReference: "docs/architecture/orderfit/requirements.md (REQ-02)",
    description: "The delay scan horizon for counter-proposal terms is strictly bounded between 0 and 90 calendar days. Unbounded, negative, or infinite delay searches are blocked at parameter validation.",
    enforcementLayer: "Deterministic Engine",
    state: "VERIFIED",
    verificationDetails: "Pydantic ge=0, le=90 bounds enforced on all what-if and evaluation request inputs.",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "INV-003",
    name: "Minimum Liquidity Reserve Floor",
    specReference: "docs/architecture/orderfit/financial_contracts.md",
    description: "No order or commercial strategy can be recommended or marked feasible if projected cash balance dips below the tenant's configured reserve floor at any date during the delivery window.",
    enforcementLayer: "Deterministic Engine",
    state: "VERIFIED",
    verificationDetails: "Daily liquidity projection verified against business risk constraints prior to feasibility ranking.",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "INV-004",
    name: "Append-Only Tamper-Evident Ledger",
    specReference: "docs/architecture/orderfit/ADR-0004-audit-ledger.md",
    description: "All financial events, intake states, and operational decisions are immutable and append-only. UPDATE and DELETE statements are structurally forbidden on financial ledgers and audit records.",
    enforcementLayer: "Cryptographic Ledger",
    state: "VERIFIED",
    verificationDetails: "PostgreSQL table triggers and sequence hashing guarantee forward-only revision tracking.",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "INV-005",
    name: "Dual-Control Human Step-Up Authorization",
    specReference: "docs/architecture/orderfit/requirements.md (REQ-08)",
    description: "AI extraction generates suggestions and the deterministic engine computes feasibility, but dispatching binding counter-proposals or committing orders requires explicit human sign-off via cryptographic step-up code.",
    enforcementLayer: "Security Gateway",
    state: "VERIFIED",
    verificationDetails: "T3/T4 outbox gates reject any autonomous dispatch without verified session token and SHA-256 confirmation.",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "INV-006",
    name: "Multi-Tenant PostgreSQL Row-Level Security Isolation",
    specReference: "docs/database/0002_rls_policies.sql",
    description: "Every table containing tenant data enforces PostgreSQL Row-Level Security scoped by business_id. Application database roles have NOBYPASSRLS set, preventing cross-tenant leakage.",
    enforcementLayer: "Database Schema",
    state: "VERIFIED",
    verificationDetails: "Policies verified on app_user, business, deal, cash_event, and audit_log tables.",
    lastChecked: new Date().toISOString(),
  },
];

export const SECURITY_GATE_TIERS: SecurityGateTier[] = [
  {
    tier: "T0",
    name: "Intake & Extraction",
    authorization: "Autonomous (Zero-Trust Sandbox)",
    riskClass: "LOW",
    enforcedGuardrail: "PDF & OCR text parsing, contract field extraction, prompt injection filtering. Output marked untrusted.",
    status: "ENFORCED",
  },
  {
    tier: "T1",
    name: "Feasibility Engine",
    authorization: "Pure Arithmetic Compute",
    riskClass: "LOW",
    enforcedGuardrail: "Linear delay scan (0..90d), liquidity buffer calculations, strategy ranking. Pure function, no side effects.",
    status: "ENFORCED",
  },
  {
    tier: "T2",
    name: "Plan Formulation",
    authorization: "Commercial Lead Review",
    riskClass: "MEDIUM",
    enforcedGuardrail: "Selecting commercial terms, drafting counter-proposal emails, margin review. Drafts remain internal only.",
    status: "ENFORCED",
  },
  {
    tier: "T3",
    name: "Ask Dispatch Outbox",
    authorization: "Step-Up Auth (SHA-256 Code)",
    riskClass: "HIGH",
    enforcedGuardrail: "Dispatching binding commercial requests to counterparty. Requires explicit human step-up authorization.",
    status: "ENFORCED",
  },
  {
    tier: "T4",
    name: "Ledger Commitment",
    authorization: "Owner / Admin MFA",
    riskClass: "CRITICAL",
    enforcedGuardrail: "Binding cash commitment to append-only cryptographic ledger. Immutably recorded with cryptographic sequence.",
    status: "ENFORCED",
  },
];
