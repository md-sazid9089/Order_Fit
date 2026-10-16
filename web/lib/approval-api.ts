// Typed client for the P6 approval and sandbox-execution operations. Every write goes through the serialized,
// CSRF-protected, idempotent `mutate` path, so a lost response is retried with the same command key.
import { get, mutate } from "./orderfit-api";
import type { ApprovalRequest, ApprovalView, BundleView, CompensationRequest, ExecuteRequest, ExecutionRun, OperationAccepted, Page_ActionView_, PrepareBundle, ReasonCommand, StepUp, StepUpView, ActionView } from "./generated-api";

const scope = (businessId: string) => `/businesses/${businessId}`;

export const prepareBundle = (b: string, dealId: string, body: PrepareBundle) => mutate<BundleView>(`${scope(b)}/deals/${dealId}/bundles`, "POST", body);
export const prepareCompensation = (b: string, dealId: string, body: CompensationRequest) => mutate<BundleView>(`${scope(b)}/deals/${dealId}/compensation-bundles`, "POST", body);
export const getBundle = (b: string, bundleId: string) => get<BundleView>(`${scope(b)}/bundles/${bundleId}`);
export const getApproval = (b: string, approvalId: string) => get<ApprovalView>(`${scope(b)}/approvals/${approvalId}`);
export const getRun = (b: string, runId: string) => get<ExecutionRun>(`${scope(b)}/execution-runs/${runId}`);
/** Password re-authentication for one exact bundle. The password is sent once and never kept by this client. */
export const stepUp = (body: StepUp) => mutate<StepUpView>("/auth/step-up", "POST", body);
export const decide = (b: string, bundleId: string, body: ApprovalRequest) => mutate<ApprovalView>(`${scope(b)}/bundles/${bundleId}/approvals`, "POST", body);
export const revokeApproval = (b: string, approvalId: string, body: ReasonCommand) => mutate<ApprovalView>(`${scope(b)}/approvals/${approvalId}/revoke`, "POST", body);
export const executeBundle = (b: string, bundleId: string, body: ExecuteRequest) => mutate<OperationAccepted>(`${scope(b)}/bundles/${bundleId}/execute`, "POST", body);

/** Every recorded action for the order, following cursors so nothing is silently truncated. */
export async function listActions(b: string, dealId: string): Promise<ActionView[]> {
  const items: ActionView[] = []; let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const result: Page_ActionView_ = await get<Page_ActionView_>(`${scope(b)}/deals/${dealId}/actions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    items.push(...result.items); cursor = result.next_cursor;
    if (!cursor) break;
  }
  return items;
}
