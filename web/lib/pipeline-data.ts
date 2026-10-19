import { ApiError, get, type BaselineView, type Constraints, type Customer, type Deal, type Evaluation } from "./orderfit-api";
import type { BusinessView } from "./generated-api";

type Page<T> = { items: T[]; next_cursor: string | null };
export type PipelineData = { more: boolean; deals: Deal[]; evaluations: Record<string, Evaluation>; customers: Record<string, string>; baseline: BaselineView | null; reserve: string | null; currency: string };
export const PIPELINE_PAGE_SIZE = 20;
const CUSTOMER_CONCURRENCY = 4;

async function optional<T>(request: Promise<T>): Promise<T | null> {
  try { return await request; }
  catch (error) { if (error instanceof ApiError && (error.status === 404 || error.status === 409)) return null; throw error; }
}

/** Fresh, business-scoped reads for one bounded page. Never caches financial results. */
export async function loadPipeline(businessId: string, offset: number, signal?: AbortSignal, limit: number = PIPELINE_PAGE_SIZE): Promise<PipelineData> {
  signal?.throwIfAborted();
  const base = `/businesses/${businessId}`;
  const read = <T>(path: string) => get<T>(`${base}/${path}`, { signal });
  const [profile, deals, baseline] = await Promise.all([
    read<BusinessView>("profile"),
    read<Page<Deal>>(`deals?limit=${limit}&offset=${offset}`),
    optional(read<BaselineView>("baseline")),
  ]);
  const [customerPage, constraints] = await Promise.all([
    read<Page<Customer>>("customers"), read<Page<Constraints>>("constraints?default_only=true"),
  ]);
  const customers: Record<string, string> = Object.fromEntries(customerPage.items.map(customer => [customer.id, customer.customer.name]));
  const byEvaluation: Record<string, Evaluation> = {};
  const customerIds = [...new Set(deals.items.flatMap(deal => deal.inputs.customer_id && !(deal.inputs.customer_id in customers) ? [deal.inputs.customer_id] : []))];
  const evaluationIds = [...new Set(deals.items.flatMap(deal => deal.live_evaluation_id ? [deal.live_evaluation_id] : []))];
  // Replace the serial label waterfall with four slots. Finish this queue before
  // the existing evaluation wave, so concurrency never exceeds the old page peak.
  const tasks: (() => Promise<void>)[] = customerIds.map(id => async () => {
      const customer = await optional(read<Customer>(`customers/${id}`));
      if (customer) customers[id] = customer.customer.name;
    });
  let next = 0;
  let stopped = false;
  await Promise.all(Array.from({ length: Math.min(CUSTOMER_CONCURRENCY, tasks.length) }, async () => {
    while (!stopped && next < tasks.length) {
      signal?.throwIfAborted();
      const task = tasks[next++];
      try { await task(); } catch (error) { stopped = true; throw error; }
    }
  }));
  signal?.throwIfAborted();
  // Preserve parallel evaluation loading for the common case with known labels.
  // IDs come only from this 20-order page; never fetch an unbounded collection.
  await Promise.all(evaluationIds.map(async id => {
    const evaluation = await optional(read<Evaluation>(`evaluations/${id}`));
    if (evaluation) byEvaluation[id] = evaluation;
  }));
  signal?.throwIfAborted();
  const evaluations: Record<string, Evaluation> = {};
  for (const deal of deals.items) {
    const evaluation = deal.live_evaluation_id ? byEvaluation[deal.live_evaluation_id] : undefined;
    if (evaluation) evaluations[deal.id] = evaluation;
  }
  return { more: !!deals.next_cursor, deals: deals.items, evaluations, customers, baseline,
    reserve: constraints.items.find(policy => policy.is_default)?.reserve_minor ?? null, currency: profile.currency };
}
