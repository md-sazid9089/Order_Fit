import type { AdminCapabilities } from "./generated-api";

export function platformAdminEnabled(capabilities?: AdminCapabilities | null): boolean {
  return capabilities?.read_enabled === true;
}
