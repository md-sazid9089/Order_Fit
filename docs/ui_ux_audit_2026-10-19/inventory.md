# Route and API inventory

Generated from the final source tree, with recursive first-party imports. This is STATIC evidence; browser coverage is recorded separately in coverage.md. Route access is a UI convenience; every API operation independently authorizes the session and tenant.

| Route | Source | Component | Guard | Kind | State implementations found | Entry components |
|---|---|---|---|---|---|---|
| /admin/engine | web/app/admin/engine/page.tsx | server | server platform-admin verification | redirect |  | page.tsx |
| /admin/logs | web/app/admin/logs/page.tsx | server | server platform-admin verification | live screen | error/retry | page.tsx, page-header.tsx, inline-alert.tsx |
| /admin/orders | web/app/admin/orders/page.tsx | client | server platform-admin verification | live screen | loading, error/retry, empty | page.tsx, page-header.tsx, status-badge.tsx, skeleton.tsx, admin-data.tsx |
| /admin | web/app/admin/page.tsx | client | server platform-admin verification | live screen | loading, error/retry, empty | page.tsx, page-header.tsx, panel.tsx, stat-tile.tsx, status-badge.tsx |
| /admin/security | web/app/admin/security/page.tsx | server | server platform-admin verification | live screen | empty | page.tsx, page-header.tsx, panel.tsx |
| /admin/system | web/app/admin/system/page.tsx | client | server platform-admin verification | live screen | loading, error/retry, empty | page.tsx, page-header.tsx, panel.tsx, status-badge.tsx, skeleton.tsx |
| /admin/tenants | web/app/admin/tenants/page.tsx | client | server platform-admin verification | live screen | loading, error/retry, empty | page.tsx, page-header.tsx, status-badge.tsx, skeleton.tsx, admin-data.tsx |
| /admin/users | web/app/admin/users/page.tsx | client | server platform-admin verification | live screen | loading, error/retry, empty | page.tsx, page-header.tsx, status-badge.tsx, skeleton.tsx, admin-data.tsx |
| /audit-log | web/app/audit-log/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /auth/forgot-password | web/app/auth/forgot-password/page.tsx | client | public | live screen | loading, error/retry, empty | page.tsx, auth-frame.tsx, theme-toggle.tsx, inline-alert.tsx, account-access-api.ts |
| /auth/invitations/accept | web/app/auth/invitations/accept/page.tsx | server | public | live screen | loading, error/retry, empty | page.tsx, accept-invitation.tsx, orderfit-api.ts, session-reset.ts, p7-api.ts |
| /auth/reset-password | web/app/auth/reset-password/page.tsx | client | public | live screen | loading, error/retry | page.tsx, auth-frame.tsx, theme-toggle.tsx, inline-alert.tsx, account-access-api.ts |
| /auth/signin | web/app/auth/signin/page.tsx | client | public | live screen | error/retry, empty | page.tsx, orderfit-api.ts, session-expiry.ts, session-reset.ts, session-store.ts |
| /auth/signup | web/app/auth/signup/page.tsx | client | public | live screen | loading, error/retry | page.tsx, orderfit-api.ts, session-reset.ts, session-store.ts, auth-frame.tsx |
| /auth/verify-email | web/app/auth/verify-email/page.tsx | client | public | live screen | loading, error/retry | page.tsx, auth-frame.tsx, theme-toggle.tsx, inline-alert.tsx, account-access-api.ts |
| /cash-flow | web/app/cash-flow/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /deals/[id]/confirm | web/app/deals/[id]/confirm/page.tsx | server | AuthShell + API membership/role checks | redirect |  | page.tsx |
| /deals/[id]/documents | web/app/deals/[id]/documents/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, collection-pages.tsx, orderfit-api.ts, order-journey.tsx, auth-shell.tsx |
| /deals/[id]/negotiate | web/app/deals/[id]/negotiate/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, preparation-workspace.tsx, collection-pages.tsx, orderfit-api.ts, auth-shell.tsx |
| /deals/[id] | web/app/deals/[id]/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, collection-pages.tsx, orderfit-api.ts, p7-model.ts, auth-shell.tsx |
| /deals/[id]/reply | web/app/deals/[id]/reply/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, preparation-workspace.tsx, collection-pages.tsx, orderfit-api.ts, auth-shell.tsx |
| /deals/customers | web/app/deals/customers/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, customers-screen.tsx, collection-pages.tsx, orderfit-api.ts, p7-api.ts |
| /deals/new | web/app/deals/new/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, collection-pages.tsx, orderfit-api.ts, auth-shell.tsx, session-reset.ts |
| /deals/new/validate | web/app/deals/new/validate/page.tsx | server | AuthShell + API membership/role checks | redirect |  | page.tsx |
| /deals | web/app/deals/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, orderfit-api.ts, pipeline-data.ts, approval-model.ts, pipeline-model.ts |
| /deals/sources | web/app/deals/sources/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, collection-pages.tsx, orderfit-api.ts, auth-shell.tsx, session-reset.ts |
| /financing | web/app/financing/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /orders | web/app/orders/page.tsx | server | AuthShell + API membership/role checks | redirect |  | page.tsx |
| /overview | web/app/overview/page.tsx | client | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, states.tsx, scope.ts, orderfit-api.ts, approval-model.ts |
| / | web/app/page.tsx | server | public | live screen | loading, empty | page.tsx, announcement-banner.tsx, navbar.tsx, smooth-scroll-provider.tsx, use-session.ts |
| /payees | web/app/payees/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /risk-constraints | web/app/risk-constraints/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /sandbox | web/app/sandbox/page.tsx | server | AuthShell + API membership/role checks | redirect |  | page.tsx |
| /settings | web/app/settings/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /useraccess | web/app/useraccess/page.tsx | server | AuthShell + API membership/role checks | live screen | loading, error/retry, empty | page.tsx, authenticated-page.tsx, auth-shell.tsx, orderfit-api.ts, session-reset.ts |
| /users | web/app/users/page.tsx | server | AuthShell + API membership/role checks | redirect |  | page.tsx |

## API call-site inventory

Literal call sites include templates whose IDs/prefixes come from the verified scope. Dynamic paths are retained here rather than guessed into fake endpoints. Supporting API wrappers, collections and hooks must be traced from each route above.

| File:line | Call | Source expression |
|---|---|---|
| web/app/admin/layout.tsx:21 | get | `const sessionToken = cookieStore.get("orderfit_session")?.value;` |
| web/app/admin/layout.tsx:22 | get | `const csrfToken = cookieStore.get("orderfit_csrf")?.value;` |
| web/app/admin/page.tsx:16 | useQuery | `const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: ({ signal }) => getAdminOverview(signal), retry: adminRetry, retryDelay: adminRetryDelay });` |
| web/app/admin/page.tsx:17 | useQuery | `const system = useQuery({ queryKey: ["admin", "system"], queryFn: ({ signal }) => getAdminSystem(signal), retry: adminRetry, retryDelay: adminRetryDelay });` |
| web/app/admin/system/page.tsx:13 | useQuery | `const system = useQuery({ queryKey: ["admin", "system"], queryFn: ({ signal }) => getAdminSystem(signal), retry: adminRetry, retryDelay: adminRetryDelay, refetchInterval: 30_000 });` |
| web/app/api/health/route.ts:11 | fetch | `const res = await fetch(\`${SERVER_API_URL.replace(/\/$/, "")}${path}\`, { signal: AbortSignal.timeout(3000), cache: "no-store" });` |
| web/app/api/health/route.ts:20 | fetch | `const res = await fetch(\`${SERVER_API_URL.replace(/\/$/, "")}/ready\`, { signal: AbortSignal.timeout(3000), cache: "no-store" });` |
| web/app/auth/forgot-password/page.tsx:14 | useQuery | `const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });` |
| web/app/auth/signin/page.tsx:26 | get | `const text = signInNotice(new URLSearchParams(window.location.search).get("reason"));` |
| web/app/auth/signin/page.tsx:39 | mutate | `session = await mutate<Session>("/auth/signin", "POST", { email: normalizedEmail, password });` |
| web/app/auth/signin/page.tsx:48 | get | `router.replace(safeNext(params.get("next")) ?? safeReturnPath(params.get("return")) ?? fallback);` |
| web/app/auth/signup/page.tsx:54 | mutate | `const session = await mutate<Session>("/auth/signup", "POST", {` |
| web/app/auth/verify-email/page.tsx:19 | useQuery | `const session = useQuery({ queryKey: ["verify-email-session"], queryFn: () => fetchSession(), retry: false });` |
| web/app/deals/[id]/documents/page.tsx:22 | get | `const op = await get<Operation>(\`/businesses/${businessId}/operations/${operationId}\`);` |
| web/app/deals/[id]/documents/page.tsx:33 | useCollection | `const documentPages = useCollection<DocumentView>(\`/businesses/${scope?.businessId}/deals/${scope?.dealId}/documents\`, !!scope);` |
| web/app/deals/[id]/documents/page.tsx:44 | get | `const [d, extracted] = await Promise.all([get<Deal>(\`/businesses/${scope.businessId}/deals/${scope.dealId}\`), listFields(scope.businessId, scope.dealId)]);` |
| web/app/deals/[id]/documents/page.tsx:167 | get | `<section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Extracted values</h2>{fields.length === 0 && !error ? <p className="text-sm">No extracted values yet. Upload a documen` |
| web/app/deals/[id]/page.tsx:77 | useCollection | `const policyPages = useCollection<ConstraintsView>(\`/businesses/${businessId}/constraints\`, !!businessId);` |
| web/app/deals/[id]/page.tsx:114 | get | `const d = await get<Deal>(\`/businesses/${businessId}/deals/${resolvedUuid}\`);` |
| web/app/deals/[id]/page.tsx:119 | get | `? get<Evaluation>(\`/businesses/${businessId}/evaluations/${d.live_evaluation_id}\`).catch(() => { failures.push("the saved evaluation"); return null; })` |
| web/app/deals/[id]/page.tsx:121 | get | `get<Review>(\`/businesses/${businessId}/deals/${resolvedUuid}/review\`).catch(() => { failures.push("the input review checks"); return null; }),` |
| web/app/deals/[id]/page.tsx:139 | get | `async function poll() { try { const current = await get<Operation>(\`/businesses/${businessId}/operations/${route!.operationId}\`); if (!active) return; setOperation(current); if (["queued", "running"].includes(c` |
| web/app/deals/[id]/page.tsx:142 | mutate | `async function save(e: FormEvent) { e.preventDefault(); if (!deal \|\| !editing) return; setBusy(true); setError(""); try { await mutate(\`/businesses/${businessId}/deals/${dealId}\`, "PATCH", { expected_version: d` |
| web/app/deals/[id]/page.tsx:143 | mutate | `async function command(name: string) { if (!deal) return; setBusy(true); setError(""); try { await mutate(\`/businesses/${businessId}/deals/${dealId}/${name}\`, "POST", { expected_version: deal.version, expected_` |
| web/app/deals/[id]/page.tsx:147 | mutate | `const confirmed = await mutate<Snapshot>(\`/businesses/${businessId}/deals/${dealId}/confirm\`, "POST", { expected_version: review.version, expected_input_version: review.input_version, expected_financial_revisio` |
| web/app/deals/[id]/page.tsx:148 | get | `const afterConfirm = await get<Deal>(\`/businesses/${businessId}/deals/${dealId}\`);` |
| web/app/deals/[id]/page.tsx:149 | mutate | `const op = await mutate<Operation>(\`/businesses/${businessId}/deals/${dealId}/evaluations\`, "POST", { expected_version: afterConfirm.version, expected_input_version: confirmed.input_version, expected_financial_` |
| web/app/deals/new/page.tsx:57 | useCollection | `const customerPages = useCollection<Customer>(\`/businesses/${businessId}/customers\`, !!businessId);` |
| web/app/deals/new/page.tsx:58 | useCollection | `const policyPages = useCollection<ConstraintsView>(\`/businesses/${businessId}/constraints\`, !!businessId);` |
| web/app/deals/new/page.tsx:69 | get | `const b = await get<Business>(\`/businesses/${id}/profile\`);` |
| web/app/deals/new/page.tsx:71 | get | `const defaults = await get<{ items: ConstraintsView[] }>(\`/businesses/${id}/constraints?default_only=true\`);` |
| web/app/deals/new/page.tsx:85 | get | `const balance = await get<BaselineView>(\`/businesses/${id}/baseline\`);` |
| web/app/deals/new/page.tsx:95 | get | `const id = resolveBusinessId(session.memberships, new URLSearchParams(window.location.search).get("businessId"), scoped);` |
| web/app/deals/new/page.tsx:122 | mutate | `await mutate(\`/businesses/${businessId}/baseline\`, "PATCH", {` |
| web/app/deals/new/page.tsx:149 | mutate | `const customer = await mutate<Customer>(\`/businesses/${businessId}/customers\`, "POST", {` |
| web/app/deals/new/page.tsx:165 | mutate | `(await mutate<Deal>(\`/businesses/${businessId}/deals\`, "POST", {` |
| web/app/deals/new/page.tsx:172 | mutate | `await mutate(\`/businesses/${businessId}/deals/${created.id}\`, "PATCH", {` |
| web/app/deals/sources/page.tsx:22 | get | `function text(data: FormData, name: string) { return String(data.get(name) ?? "").trim(); }` |
| web/app/deals/sources/page.tsx:33 | useCollection | `const offerPages = useCollection<OfferView>(\`/businesses/${businessId}/financing-offers\`, !!businessId);` |
| web/app/deals/sources/page.tsx:34 | useCollection | `const payeePages = useCollection<PayeeView>(\`/businesses/${businessId}/payees\`, !!businessId);` |
| web/app/deals/sources/page.tsx:35 | useCollection | `const eventPages = useCollection<CashEventView>(\`/businesses/${businessId}/cash-events\`, !!businessId);` |
| web/app/deals/sources/page.tsx:39 | get | `const [b, policies] = await Promise.all([get<Business>(\`/businesses/${id}/profile\`), get<Page<ConstraintsView>>(\`/businesses/${id}/constraints?default_only=true\`)]);` |
| web/app/deals/sources/page.tsx:41 | get | `try { setBaseline(await get<BaselineView>(\`/businesses/${id}/baseline\`)); } catch (e) { if (!(e instanceof ApiError) \|\| e.code !== "BASELINE_NOT_CONFIGURED") throw e; }` |
| web/app/deals/sources/page.tsx:43 | get | `useEffect(() => { const id = resolveBusinessId(session.memberships, new URLSearchParams(window.location.search).get("businessId"), scoped); void Promise.resolve(id).then(found => { if (found) { setBusinessId(fo` |
| web/app/deals/sources/page.tsx:50 | mutate | `function saveBaseline(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business) return; const data = new FormData(e.currentTarget); void run(() => mutate(\`/businesses/${businessId}/baseline\`, "PATCH",` |
| web/app/deals/sources/page.tsx:60 | mutate | `await mutate(\`/businesses/${businessId}/cash-events\`, "POST", { expected_financial_revision: business.financial_revision, event, ...(eventReview?.fingerprint === fingerprint && eventReview.reason.trim().length ` |
| web/app/deals/sources/page.tsx:64 | get | `const matches = await Promise.all(ids.map(id => get<CashEventDuplicates>(\`/businesses/${businessId}/cash-events/${id}/duplicates\`)));` |
| web/app/deals/sources/page.tsx:71 | mutate | `function addPayee(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business) return; const form = e.currentTarget; const data = new FormData(form); void run(() => mutate(\`/businesses/${businessId}/paye` |
| web/app/deals/sources/page.tsx:75 | mutate | `void run(() => mutate(\`/businesses/${businessId}/financing-offers\`, "POST", { expected_financial_revision: business.financial_revision, terms }), "Offer saved. Select it below and save the policy to include it ` |
| web/app/deals/sources/page.tsx:77 | mutate | `function savePolicy(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business \|\| !policy) return; const data = new FormData(e.currentTarget); const { constraints_id: _id, version: _version, ...owner } ` |
| web/components/admin/admin-data.tsx:14 | useQuery | `return useQuery({ queryKey: ["admin", "capabilities"], queryFn: ({ signal }) => getAdminCapabilities(signal), retry: adminRetry, retryDelay: adminRetryDelay, staleTime: 60_000 });` |
| web/components/admin/admin-data.tsx:51 | useInfiniteQuery | `const query = useInfiniteQuery({` |
| web/components/admin/admin-shell.tsx:23 | mutate | `await mutate("/auth/signout", "POST", {});` |
| web/components/approval/use-bundle-flow.ts:34 | get | `useEffect(() => { queueMicrotask(() => setBundleId(new URL(window.location.href).searchParams.get(PARAM[kind]) ?? "")); }, [kind]);` |
| web/components/approval/use-bundle-flow.ts:42 | get | `const op = opId ? await get<Operation>(\`/businesses/${businessId}/operations/${opId}\`).catch(() => null) : null;` |
| web/components/audit/audit-screen.tsx:20 | useInfiniteQuery | `const log = useInfiniteQuery({ queryKey: key("audit"), queryFn: ({ pageParam }) => listAudit(businessId, pageParam), initialPageParam: null as string \| null, getNextPageParam: last => last.next_cursor, retry: f` |
| web/components/auth/accept-invitation.tsx:26 | useQuery | `const session = useQuery({ queryKey: ["invitation-session"], queryFn: getSession, retry: false, staleTime: 0 });` |
| web/components/auth/accept-invitation.tsx:85 | useQuery | `const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });` |
| web/components/cash/cash-event-actions.tsx:84 | get | `useEffect(() => { void run(async () => setMatches(await get<CashEventDuplicates>(\`/businesses/${businessId}/cash-events/${eventId}/duplicates\`))); }, [businessId, eventId, run]);` |
| web/components/cash/cash-event-actions.tsx:85 | mutate | `return <div className="space-y-3">{error && <Alert>{error}</Alert>}{matches ? matches.matching_events.length ? <><DuplicateReviewFields matches={[matches.event, ...matches.matching_events]} currency={currency} ` |
| web/components/cash/cash-flow-screen.tsx:17 | useQuery | `const flow = useQuery({ queryKey: key("cash-flow"), queryFn: () => getCashFlow(businessId), retry: false });` |
| web/components/cash/cash-flow-screen.tsx:18 | useCollection | `const events = useCollection<CashEventView>(\`/businesses/${businessId}/cash-events\`);` |
| web/components/cash/cash-flow-screen.tsx:19 | useQuery | `const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });` |
| web/components/collection-pages.tsx:9 | useCollection | `export function useCollection<T extends { id: string }>(path: string, enabled = true) {` |
| web/components/collection-pages.tsx:10 | useInfiniteQuery | `const query = useInfiniteQuery({` |
| web/components/collection-pages.tsx:14 | get | `const page = await get<Page<T>>(\`${path}${path.includes("?") ? "&" : "?"}limit=50${pageParam ? \`&cursor=${encodeURIComponent(pageParam)}\` : ""}\`);` |
| web/components/customers/customers-screen.tsx:18 | useCollection | `const customers = useCollection<CustomerView>(\`/businesses/${businessId}/customers\`);` |
| web/components/customers/customers-screen.tsx:42 | useQuery | `const history = useQuery({ queryKey: key("history", customer.id, asOf), queryFn: () => getCustomerHistory(businessId, customer.id, asOf), enabled: !!asOf, retry: false });` |
| web/components/customers/customers-screen.tsx:71 | useInfiniteQuery | `const invoices = useInfiniteQuery({ queryKey: invoicesKey, queryFn: ({ pageParam }) => listInvoices(businessId, customer.id, pageParam), initialPageParam: null as string \| null, getNextPageParam: last => last.n` |
| web/components/deals/deal-evaluation-inspector.tsx:514 | get | `return get<{ points: SeriesPoint[] }>(\`/businesses/${businessId}/evaluations/${evaluationId}/series?${query}\`);` |
| web/components/financing/financing-screen.tsx:16 | useCollection | `const offers = useCollection<OfferView>(\`/businesses/${businessId}/financing-offers\`);` |
| web/components/financing/financing-screen.tsx:17 | useQuery | `const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });` |
| web/components/financing/risk-screen.tsx:15 | useCollection | `const policies = useCollection<ConstraintsView>(\`/businesses/${businessId}/constraints?default_only=true\`);` |
| web/components/financing/risk-screen.tsx:16 | useQuery | `const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });` |
| web/components/layout/auth-shell.tsx:27 | get | `const param = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("businessId") : null;` |
| web/components/layout/auth-shell.tsx:54 | get | `const id = resolveBusinessId(s.memberships, new URLSearchParams(window.location.search).get("businessId"), remembered());` |
| web/components/layout/auth-shell.tsx:58 | get | `if (url.searchParams.get("businessId") !== id) {` |
| web/components/layout/auth-shell.tsx:72 | get | `const id = resolveBusinessId(current.memberships, new URLSearchParams(window.location.search).get("businessId"), remembered());` |
| web/components/layout/auth-shell.tsx:76 | get | `if (url.searchParams.get("businessId") !== id) {` |
| web/components/layout/auth-shell.tsx:100 | mutate | `await mutate("/auth/signout", "POST", {});` |
| web/components/layout/auth-shell.tsx:178 | get | `{searchParams.get("notice") === "platform-access-required" && <p role="status" className="mx-4 mt-3 rounded-xl bg-info-soft p-3 text-sm text-info">Platform administration requires a service operator account. Yo` |
| web/components/layout/connection-indicator.tsx:13 | fetch | `const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) });` |
| web/components/notifications/notification-bell.tsx:21 | useInfiniteQuery | `const query = useInfiniteQuery({` |
| web/components/p7/common.tsx:134 | useQuery | `const query = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });` |
| web/components/payees/payees-screen.tsx:19 | useCollection | `const payees = useCollection<PayeeView>(\`/businesses/${businessId}/payees\`);` |
| web/components/payees/payees-screen.tsx:20 | useQuery | `const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });` |
| web/components/payees/payees-screen.tsx:47 | useInfiniteQuery | `const accounts = useInfiniteQuery({ queryKey: accountsKey, queryFn: ({ pageParam }) => listAccounts(businessId, payee.id, pageParam), initialPageParam: null as string \| null, getNextPageParam: last => last.next` |
| web/components/preparation-workspace.tsx:36 | useCollection | `const payeePages = useCollection<PayeeView>(\`/businesses/${businessId}/payees\`, !!businessId);` |
| web/components/preparation-workspace.tsx:64 | get | `const [d, saved] = await Promise.all([get<Deal>(\`${prefix}/deals/${dealId}\`), get<PreparationState>(\`${prefix}/deals/${dealId}/preparation?offset=${offset}\`)]);` |
| web/components/preparation-workspace.tsx:65 | get | `const ev = d.live_evaluation_id ? await get<Evaluation>(\`${prefix}/evaluations/${d.live_evaluation_id}\`) : null;` |
| web/components/preparation-workspace.tsx:66 | get | `const cat = ev ? await get<OptionCatalogue>(\`${prefix}/evaluations/${ev.id}/catalogue\`) : null;` |
| web/components/preparation-workspace.tsx:75 | get | `get<Explanation>(\`${prefix}/evaluations/${evaluation.id}/explanation?option_key=${encodeURIComponent(option)}\`).then(v => { if (active) setExplanation(v); }).catch(e => { if (active) setError(e.message); });` |
| web/components/preparation-workspace.tsx:91 | get | `const op = await get<Operation>(\`${prefix}/operations/${operationId}\`); if (!active) return; setOperation(op);` |
| web/components/preparation-workspace.tsx:129 | mutate | `const op = await mutate<Operation>(\`${prefix}/deals/${dealId}/whatifs\`, "POST", body); saveOperation(op.operation_id);` |
| web/components/preparation-workspace.tsx:134 | mutate | `const op = await mutate<Operation>(\`${prefix}/deals/${dealId}/explanations\`, "POST", body); saveOperation(op.operation_id);` |
| web/components/preparation-workspace.tsx:139 | mutate | `const op = await mutate<Operation>(\`${prefix}/deals/${dealId}/clause-assessments\`, "POST", body); saveOperation(op.operation_id);` |
| web/components/preparation-workspace.tsx:144 | mutate | `const op = await mutate<Operation>(\`${prefix}/deals/${dealId}/drafts\`, "POST", body); saveOperation(op.operation_id);` |
| web/components/preparation-workspace.tsx:250 | mutate | `<button className={button} disabled={disabled} onClick={() => void command(async () => { await mutate(\`${prefix}/deals/${dealId}/preparation-settings/reset\`, "POST", versions()); setNotice("Applied what-if assu` |
| web/components/preparation-workspace.tsx:261 | mutate | `<section className={panel}><h2 className="text-lg font-semibold">Saved what-if comparisons</h2>{!state?.forks.length && <p>No saved forks.</p>}{state?.forks.map(f => <ForkCard currency={deal.currency} key={f.id` |
| web/components/preparation-workspace.tsx:263 | mutate | `onEdit={data => command(async () => { await mutate(\`${prefix}/messages/${m.identity.message_id}\`, "PATCH", { ...versions(), ...data }); })}` |
| web/components/preparation-workspace.tsx:264 | mutate | `onReview={attestation => command(async () => { await mutate(\`${prefix}/messages/${m.identity.message_id}/review\`, "POST", { ...versions(), preparation_hash: m.preparation_hash, attestation }); })}` |
| web/components/preparation-workspace.tsx:265 | mutate | `onReply={body => command(async () => { const op = await mutate<Operation>(\`${prefix}/deals/${dealId}/replies\`, "POST", { ...versions(), ask_message_id: m.identity.message_id, party_id: m.identity.party_id, body` |
| web/components/preparation-workspace.tsx:266 | mutate | `onAcceptance={(attestation, valid_until, reply_id) => command(async () => { await mutate(\`${prefix}/deals/${dealId}/acceptances\`, "POST", { ...versions(), message_id: m.identity.message_id, preparation_hash: m.` |
| web/components/preparation-workspace.tsx:267 | mutate | `<section className={panel}><h2 className="text-lg font-semibold">Incoming replies: review candidates</h2>{!state?.replies.length && <p>No incoming replies.</p>}{state?.replies.map(r => <ReplyCard key={r.id} rep` |
| web/components/preparation-workspace.tsx:278 | get | `return <article className="space-y-2 border-t pt-4"><p>Fork {fork.id} · {fork.is_stale ? "stale" : "current"} · <ProvenanceBadge kind={fork.provenance} /> {fork.language_code}</p>{fork.clarification && <p role=` |
| web/components/preparation-workspace.tsx:301 | get | `useEffect(() => { let active = true; get<Series>(\`/businesses/${businessId}/evaluations/${evaluationId}/series?scenario=${scenario}&option_key=${encodeURIComponent(option)}\`).then(s => { if (active) setSeries(J` |
| web/components/settings/settings-screen.tsx:109 | useQuery | `const query = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });` |
| web/components/settings/settings-screen.tsx:157 | useQuery | `const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });` |
| web/components/users/users-screen.tsx:24 | useInfiniteQuery | `const members = useInfiniteQuery({ queryKey: membersKey, queryFn: ({ pageParam }) => listMembers(businessId, pageParam), initialPageParam: null as string \| null, getNextPageParam: last => last.next_cursor, retr` |
| web/components/users/users-screen.tsx:72 | useQuery | `const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });` |
| web/components/users/users-screen.tsx:82 | useInfiniteQuery | `const invitations = useInfiniteQuery({` |
| web/lib/account-access-api.ts:9 | get | `export const getAccountAccess = (signal?: AbortSignal) => get<AccountAccessCapabilities>("/auth/account-access", { signal });` |
| web/lib/account-access-api.ts:10 | mutate | `export const requestPasswordReset = (email: string) => mutate<Acknowledgement>("/auth/password-reset/request", "POST", { email: email.trim() });` |
| web/lib/account-access-api.ts:11 | mutate | `export const confirmPasswordReset = (token: string, newPassword: string) => mutate<Acknowledgement>("/auth/password-reset/confirm", "POST", { token, new_password: newPassword });` |
| web/lib/account-access-api.ts:12 | mutate | `export const requestEmailVerification = (currentPassword: string) => mutate<Acknowledgement>("/auth/email-verification/request", "POST", { current_password: currentPassword });` |
| web/lib/account-access-api.ts:13 | mutate | `export const confirmEmailVerification = (token: string) => mutate<Acknowledgement>("/auth/email-verification/confirm", "POST", { token });` |
| web/lib/account-access-api.ts:14 | mutate | `export const registerInvitedAccount = (token: string, fullName: string, password: string) => mutate<Acknowledgement>("/auth/invitations/register", "POST", { token, full_name: fullName.trim(), password });` |
| web/lib/account-access-api.ts:22 | mutate | `mutate<InvitationView>(\`/businesses/${businessId}/invitations/${invitation.id}/reissue\`, "POST", { expected_version: invitation.version, expected_financial_revision: financialRevision, reason: reason.trim() });` |
| web/lib/account-access-api.ts:32 | get | `const raw = new URLSearchParams(hash.replace(/^#/, "")).get("token");` |
| web/lib/admin-api.ts:11 | get | `export const getAdminCapabilities = (signal?: AbortSignal) => get<AdminCapabilities>("/admin/capabilities", { signal });` |
| web/lib/admin-api.ts:12 | get | `export const getAdminOverview = (signal?: AbortSignal) => get<AdminOverview>("/admin/overview", { signal });` |
| web/lib/admin-api.ts:13 | get | `export const getAdminSystem = (signal?: AbortSignal) => get<AdminSystem>("/admin/system", { signal });` |
| web/lib/admin-api.ts:19 | get | `return get<AdminPage<T>>(\`${path}?${query}\`, { signal });` |
| web/lib/approval-api.ts:8 | mutate | `export const prepareBundle = (b: string, dealId: string, body: PrepareBundle) => mutate<BundleView>(\`${scope(b)}/deals/${dealId}/bundles\`, "POST", body);` |
| web/lib/approval-api.ts:9 | mutate | `export const prepareCompensation = (b: string, dealId: string, body: CompensationRequest) => mutate<BundleView>(\`${scope(b)}/deals/${dealId}/compensation-bundles\`, "POST", body);` |
| web/lib/approval-api.ts:10 | get | `export const getBundle = (b: string, bundleId: string) => get<BundleView>(\`${scope(b)}/bundles/${bundleId}\`);` |
| web/lib/approval-api.ts:11 | get | `export const getApproval = (b: string, approvalId: string) => get<ApprovalView>(\`${scope(b)}/approvals/${approvalId}\`);` |
| web/lib/approval-api.ts:12 | get | `export const getRun = (b: string, runId: string) => get<ExecutionRun>(\`${scope(b)}/execution-runs/${runId}\`);` |
| web/lib/approval-api.ts:14 | mutate | `export const stepUp = (body: StepUp) => mutate<StepUpView>("/auth/step-up", "POST", body);` |
| web/lib/approval-api.ts:15 | mutate | `export const decide = (b: string, bundleId: string, body: ApprovalRequest) => mutate<ApprovalView>(\`${scope(b)}/bundles/${bundleId}/approvals\`, "POST", body);` |
| web/lib/approval-api.ts:16 | mutate | `export const revokeApproval = (b: string, approvalId: string, body: ReasonCommand) => mutate<ApprovalView>(\`${scope(b)}/approvals/${approvalId}/revoke\`, "POST", body);` |
| web/lib/approval-api.ts:17 | mutate | `export const executeBundle = (b: string, bundleId: string, body: ExecuteRequest) => mutate<OperationAccepted>(\`${scope(b)}/bundles/${bundleId}/execute\`, "POST", body);` |
| web/lib/approval-api.ts:23 | get | `const result: Page_ActionView_ = await get<Page_ActionView_>(\`${scope(b)}/deals/${dealId}/actions?limit=100${cursor ? \`&cursor=${encodeURIComponent(cursor)}\` : ""}\`);` |
| web/lib/auth-server.ts:45 | fetch | `const res = await fetch(\`${BACKEND_INTERNAL_URL}/api/v1/auth/me\`, {` |
| web/lib/documents-api.ts:14 | get | `export const listFields = (businessId: string, dealId: string) => get<{ items: ExtractedField[] }>(\`/businesses/${businessId}/deals/${dealId}/fields\`);` |
| web/lib/documents-api.ts:15 | mutate | `export const extractDocument = (businessId: string, dealId: string, documentId: string, versions: Versions) => mutate<Accepted>(\`/businesses/${businessId}/deals/${dealId}/documents/${documentId}/extract\`, "POST` |
| web/lib/documents-api.ts:16 | mutate | `export const resolveField = (businessId: string, dealId: string, body: unknown) => mutate(\`/businesses/${businessId}/deals/${dealId}/fields/resolve\`, "POST", body);` |
| web/lib/documents-api.ts:17 | mutate | `export const previewCsv = (businessId: string, body: { document_id: string; currency: string; as_of: string; expected_financial_revision: number }) => mutate<Accepted>(\`/businesses/${businessId}/cash-events/csv` |
| web/lib/documents-api.ts:18 | get | `export const getCsvPreview = (businessId: string, id: string) => get<CsvPreview>(\`/businesses/${businessId}/cash-events/csv-previews/${id}\`);` |
| web/lib/documents-api.ts:19 | mutate | `export const confirmCsv = (businessId: string, body: CSVConfirm) => mutate(\`/businesses/${businessId}/cash-events/csv-confirm\`, "POST", body);` |
| web/lib/documents-api.ts:23 | mutateUpload | `mutateUpload<DocumentView>(\`/businesses/${businessId}/deals/${dealId}/documents\`, meta, file);` |
| web/lib/documents-api.ts:33 | fetch | `try { response = await fetch(apiPath(path), { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(30_000) }); } catch { throw new NetworkError(); }` |
| web/lib/orderfit-api.ts:48 | fetch | `try { response = await fetch(\`${ROOT}${path}\`, { ...init, signal: typeof AbortSignal !== "undefined" ? (init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000)) :` |
| web/lib/orderfit-api.ts:73 | get | `export async function get<T>(path: string, options: Pick<RequestInit, "signal"> = {}): Promise<T> { return request<T>(path, options); }` |
| web/lib/orderfit-api.ts:97 | get | `let scope = pending.get("scope");` |
| web/lib/orderfit-api.ts:105 | get | `let key = storageKey ? pending.get(storageKey) : undefined;` |
| web/lib/orderfit-api.ts:132 | mutate | `export function mutate<T>(path: string, method: "POST" \| "PATCH", body: unknown): Promise<T> {` |
| web/lib/orderfit-api.ts:142 | mutateUpload | `export function mutateUpload<T>(path: string, metadata: unknown, file: File): Promise<T> {` |
| web/lib/orderfit-api.ts:178 | get | `return get<BusinessOverviewView>(\`/businesses/${businessId}/overview${qs}\`, options);` |
| web/lib/p7-api.ts:11 | mutate | `export const acceptInvitation = (body: InvitationAccept) => mutate<SessionView>("/auth/invitations/accept", "POST", body);` |
| web/lib/p7-api.ts:12 | mutate | `export const updateOwnProfile = (body: ProfileWrite) => mutate<SessionView>("/auth/profile", "PATCH", body);` |
| web/lib/p7-api.ts:13 | get | `export const getSession = () => get<SessionView>("/auth/me");` |
| web/lib/p7-api.ts:15 | mutate | `export const changePassword = (body: PasswordChange) => mutate<Acknowledgement>("/auth/password", "POST", body);` |
| web/lib/p7-api.ts:18 | get | `export const getBusiness = (b: string) => get<BusinessView>(\`${scope(b)}/profile\`);` |
| web/lib/p7-api.ts:19 | mutate | `export const updateBusinessProfile = (b: string, body: BusinessProfileWrite) => mutate<BusinessView>(\`${scope(b)}/profile\`, "PATCH", body);` |
| web/lib/p7-api.ts:20 | get | `export const listMembers = (b: string, cursor?: string \| null) => get<Page_Member_>(\`${scope(b)}/members${paged(cursor, 100)}\`);` |
| web/lib/p7-api.ts:21 | mutate | `export const changeRole = (b: string, userId: string, body: MembershipWrite) => mutate<Member>(\`${scope(b)}/members/${userId}\`, "PATCH", body);` |
| web/lib/p7-api.ts:22 | mutate | `export const revokeMember = (b: string, userId: string, body: RevisionReason) => mutate<Member>(\`${scope(b)}/members/${userId}/revoke\`, "POST", body);` |
| web/lib/p7-api.ts:23 | mutate | `export const createInvitation = (b: string, body: InvitationCreate) => mutate<InvitationView>(\`${scope(b)}/invitations\`, "POST", body);` |
| web/lib/p7-api.ts:24 | mutate | `export const revokeInvitation = (b: string, invitationId: string, body: RevisionReason) => mutate<InvitationView>(\`${scope(b)}/invitations/${invitationId}/revoke\`, "POST", body);` |
| web/lib/p7-api.ts:25 | get | `export const getCapabilities = (b: string) => get<Capabilities>(\`${scope(b)}/capabilities\`);` |
| web/lib/p7-api.ts:28 | get | `export const listPayees = (b: string, cursor?: string \| null) => get<Page_PayeeView_>(\`${scope(b)}/payees${paged(cursor)}\`);` |
| web/lib/p7-api.ts:29 | get | `export const listAccounts = (b: string, payeeId: string, cursor?: string \| null) => get<Page_AccountView_>(\`${scope(b)}/payees/${payeeId}/accounts${paged(cursor, 100)}\`);` |
| web/lib/p7-api.ts:30 | mutate | `export const createAccount = (b: string, payeeId: string, body: AccountCreate) => mutate<AccountView>(\`${scope(b)}/payees/${payeeId}/accounts\`, "POST", body);` |
| web/lib/p7-api.ts:31 | mutate | `export const verifyAccount = (b: string, payeeId: string, accountId: string, body: AccountVerification) => mutate<AccountView>(\`${scope(b)}/payees/${payeeId}/accounts/${accountId}/verify\`, "POST", body);` |
| web/lib/p7-api.ts:32 | mutate | `export const revokeAccount = (b: string, payeeId: string, accountId: string, body: RevisionReason) => mutate<AccountView>(\`${scope(b)}/payees/${payeeId}/accounts/${accountId}/revoke\`, "POST", body);` |
| web/lib/p7-api.ts:39 | mutate | `return mutate<DealView>(path, "POST", body);` |
| web/lib/p7-api.ts:43 | get | `export const listNotifications = (b: string, cursor?: string \| null) => get<Page_Notification_>(\`${scope(b)}/notifications${paged(cursor, 50)}\`);` |
| web/lib/p7-api.ts:45 | mutate | `export const markNotificationRead = (b: string, id: string) => mutate<Notification>(\`${scope(b)}/notifications/${id}/read\`, "POST", null);` |
| web/lib/p7-api.ts:46 | mutate | `export const markNotificationsRead = (b: string, body: NotificationsRead) => mutate<Acknowledgement>(\`${scope(b)}/notifications/read\`, "POST", body);` |
| web/lib/p7-api.ts:49 | get | `export const listAudit = (b: string, cursor?: string \| null) => get<Page_AuditRow_>(\`${scope(b)}/audit${paged(cursor, 50)}\`);` |
| web/lib/p7-api.ts:52 | get | `return get<AuditExport>(\`${scope(b)}/audit/export${query.size ? \`?${query}\` : ""}\`);` |
| web/lib/p7-api.ts:54 | mutate | `export const createCashExport = (b: string) => mutate<ExportView>(\`${scope(b)}/cash-events/export\`, "POST", null);` |
| web/lib/p7-api.ts:55 | mutate | `export const createDecisionExport = (b: string, dealId: string) => mutate<ExportView>(\`${scope(b)}/deals/${dealId}/decision-export\`, "POST", null);` |
| web/lib/p7-api.ts:71 | fetch | `try { response = await fetch(apiPath(path), { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(30_000) }); } catch { throw new NetworkError(); }` |
| web/lib/p7-api.ts:77 | get | `export const listBaselineEvents = (b: string, cursor?: string \| null) => get<Page_CashEventView_>(\`${scope(b)}/cash-events${paged(cursor)}\`);` |
| web/lib/p7-api.ts:78 | mutate | `export const correctCashEvent = (b: string, eventId: string, body: CashEventWrite) => mutate<CashEventView>(\`${scope(b)}/cash-events/${eventId}\`, "PATCH", body);` |
| web/lib/p7-api.ts:79 | mutate | `export const voidCashEvent = (b: string, eventId: string, body: RevisionReason) => mutate<CashEventView>(\`${scope(b)}/cash-events/${eventId}/void\`, "POST", body);` |
| web/lib/p7-api.ts:80 | mutate | `export const archiveCustomer = (b: string, customerId: string, body: RevisionReason) => mutate<CustomerView>(\`${scope(b)}/customers/${customerId}/archive\`, "POST", body);` |
| web/lib/p7-api.ts:81 | mutate | `export const archivePayee = (b: string, payeeId: string, body: RevisionReason) => mutate<PayeeView>(\`${scope(b)}/payees/${payeeId}/archive\`, "POST", body);` |
| web/lib/p7-api.ts:82 | mutate | `export const archiveOffer = (b: string, offerId: string, body: RevisionReason) => mutate<OfferView>(\`${scope(b)}/financing-offers/${offerId}/archive\`, "POST", body);` |
| web/lib/p7-api.ts:83 | get | `export const getCashFlow = (b: string) => get<Series>(\`${scope(b)}/cash-flow\`);` |
| web/lib/p7-api.ts:84 | get | `export const listCustomers = (b: string, cursor?: string \| null) => get<Page_CustomerView_>(\`${scope(b)}/customers${paged(cursor)}\`);` |
| web/lib/p7-api.ts:85 | get | `export const getCustomerHistory = (b: string, customerId: string, asOf: string) => get<CustomerHistory>(\`${scope(b)}/customers/${customerId}/history?as_of=${encodeURIComponent(asOf)}\`);` |
| web/lib/p7-api.ts:86 | get | `export const listInvoices = (b: string, customerId: string, cursor?: string \| null) => get<Page_InvoiceView_>(\`${scope(b)}/customers/${customerId}/invoices${paged(cursor, 100)}\`);` |
| web/lib/p7-api.ts:87 | mutate | `export const importInvoices = (b: string, customerId: string, body: InvoiceImport) => mutate<Page_InvoiceView_>(\`${scope(b)}/customers/${customerId}/invoices/import\`, "POST", body);` |
| web/lib/p7-api.ts:91 | get | `export const listOffers = (b: string, cursor?: string \| null) => get<Page_OfferView_>(\`${scope(b)}/financing-offers${paged(cursor)}\`);` |
| web/lib/p7-api.ts:92 | get | `export const listConstraints = (b: string, cursor?: string \| null) => get<Page_ConstraintsView_>(\`${scope(b)}/constraints${paged(cursor)}\`);` |
| web/lib/p7-model.ts:134 | get | `const value = new URLSearchParams(hash.slice(1)).get("token");` |
| web/lib/passkeys.ts:14 | mutate | `const options = await mutate<Options>("/auth/passkeys/enroll/options", "POST", { password });` |
| web/lib/passkeys.ts:18 | mutate | `await mutate("/auth/passkeys/enroll/verify", "POST", {` |
| web/lib/passkeys.ts:25 | mutate | `const options = await mutate<Options>("/auth/passkeys/login/options", "POST", { email, password });` |
| web/lib/passkeys.ts:26 | get | `const credential = await navigator.credentials.get({ publicKey:` |
| web/lib/passkeys.ts:29 | mutate | `return mutate<Session>("/auth/passkeys/login/verify", "POST", {` |
| web/lib/pipeline-data.ts:18 | get | `const read = <T>(path: string) => get<T>(\`${base}/${path}\`, { signal });` |
| web/lib/session-store.ts:29 | get | `inFlightSession = get<Session>("/auth/me")` |
| web/lib/session-store.ts:36 | get | `await get("/auth/csrf");` |
| web/lib/session-store.ts:37 | get | `const s = await get<Session>("/auth/me");` |

## Capability and workflow map

| Workflow | Producer / authority | UI consumer / outcome |
|---|---|---|
| Order entry → review → confirm → evaluate | deals/review/confirm/evaluations; durable operations; deterministic engine | New order, saved review, persisted evaluation, OrderJourney |
| Document intake | private upload, parser/extraction operations, reviewed candidates | Saved-order Documents; AI-off explicitly unavailable, manual entry retained |
| What-if → message → reply | preparation/forks/drafts/replies; reviewed immutable evidence | Preparation workspace; no dispatch without separate approval |
| Send → acceptance → commit → compensation | exact manifests, human step-up and durable sandbox runs | ApprovalWorkflow, persisted run recovery, inverse sandbox evidence |
| Cash sources and duplicates | version/revision-bound cash events and duplicate reviews | Currency inputs, explicit distinct-obligation reasons, correction/void history |
| Membership and account access | server capability flags, one-use invitations, current membership | Team, invitation acceptance, gated recovery and verification |
| Platform administration | server session/flag + admin read functions; API feature flag | Ready/disabled/unavailable; no platform mutations or fabricated telemetry |

## Contract ownership

- Money and verdicts: backend engine only; UI formats exact minor-unit strings. Chart coordinate scaling is presentation only.
- Role, freshness, idempotency, audit and effect authority: backend; UI mirrors allowed actions and retains command identity.
- Password recovery, verification, invitation delivery: account-access capabilities, not hard-coded claims.
- Parse failure reasons and validation field locations remain a backend contract limitation; UI presents the available state without inventing details.
