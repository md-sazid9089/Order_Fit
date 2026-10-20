import { ApiError, get } from "./orderfit-api";
import type { AdminCapabilities, AdminOverview, AdminSystem, AdminUser, AdminTenant, AdminOrder } from "./generated-api";
import { platformAdminEnabled } from "./platform-admin";

export type AdminSection = "overview" | "users" | "tenants" | "orders" | "system" | "logs" | "engine" | "security";
export type AdminRow = AdminUser | AdminTenant | AdminOrder;
export type AdminState = {
  loading: boolean; enabled: boolean; message: string; rows: readonly AdminRow[];
  next: string | null; overview: AdminOverview | null; system: AdminSystem | null;
  overviewError: string; systemError: string;
};
export const emptyAdminState = (): AdminState => ({ loading: false, enabled: false, message: "", rows: [], next: null, overview: null, system: null, overviewError: "", systemError: "" });

export function adminError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === "SESSION_REAUTH_REQUIRED") return "Your session ended. Sign in again.";
    if (error.status === 403) return "Platform administrator access denied.";
    if (error.code === "INVALID_CURSOR") return "This continuation expired or is invalid. Restart from the first page.";
    if (error.code === "ADMIN_DATA_UNSUPPORTED") return "Recorded administrative data cannot be displayed safely.";
    if (error.code === "ADMIN_TELEMETRY_UNAVAILABLE") return "Platform administrative reads are unavailable.";
  }
  return "Administrative data could not be loaded. Retry when the service is available.";
}

export class AdminData {
  state = emptyAdminState();
  private controller: AbortController | null = null;
  private generation = 0;
  constructor(private publish: (state: AdminState) => void, private read: typeof get = get) {}
  private async fetch<T>(path: string, signal: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.read<T>(path, { signal }); }
      catch (error) {
        if (signal.aborted || attempt >= 2 || !(error instanceof ApiError) || error.status !== 503 || !["DEPENDENCY_UNAVAILABLE", "DATABASE_CAPACITY"].includes(error.code)) throw error;
        await new Promise<void>((resolve, reject) => {
          const aborted = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, 150 * (attempt + 1));
          signal.addEventListener("abort", aborted, { once: true });
          if (signal.aborted) aborted();
        });
      }
    }
  }
  private update(change: Partial<AdminState>) { this.state = { ...this.state, ...change }; this.publish(this.state); }
  clear() {
    this.generation++;
    this.controller?.abort();
    this.state = emptyAdminState();
    this.publish(this.state);
  }
  updateRow(updatedRow: AdminRow) {
    this.update({
      rows: this.state.rows.map((r) => (r.id === updatedRow.id ? updatedRow : r)),
    });
  }
  async load(section: AdminSection, more = false) {
    if (more && (this.state.loading || !this.state.next)) return;
    const cursor = more ? this.state.next : null;
    const previous = more ? this.state.rows : [];
    if (!more) {
      this.clear();
    } else {
      this.generation++;
      this.controller?.abort();
    }
    const generation = this.generation;
    const controller = this.controller = new AbortController();
    const current = () => generation === this.generation && !controller.signal.aborted;
    this.update({ loading: true });
    try {
      const capabilities = await this.fetch<AdminCapabilities>("/admin/capabilities", controller.signal);
      if (!current()) return;
      if (!platformAdminEnabled(capabilities)) {
        this.update({ loading: false, message: "Platform administrative reads are unavailable. Global data has not been loaded." });
        return;
      }
      this.update({ enabled: true });
      const panel = async (kind: "overview" | "system") => {
        try {
          const value = await this.fetch<AdminOverview & AdminSystem>(`/admin/${kind}`, controller.signal);
          if (current()) this.update({ [kind]: value });
        } catch (error) {
          if (!current()) return;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.code === "ADMIN_TELEMETRY_UNAVAILABLE")) throw error;
          this.update({ [kind + "Error"]: adminError(error) });
        }
      };
      if (section === "overview") await Promise.all([panel("overview"), panel("system")]);
      else if (section === "system") await panel("system");
      else if (["users", "tenants", "orders"].includes(section)) {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);
        const page = await this.fetch<{ items: readonly AdminRow[]; next_cursor: string | null }>(`/admin/${section}?${params}`, controller.signal);
        if (current()) this.update({ rows: [...previous, ...page.items], next: page.next_cursor });
      }
    } catch (error) {
      if (!current()) return;
      this.clear();
      this.update({ message: adminError(error) });
    } finally {
      if (current()) this.update({ loading: false });
    }
  }
}
