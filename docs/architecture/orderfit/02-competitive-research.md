# 02 Competitive research

Part of the [OrderFit design set](README.md). Detailed notes with every claim, URL and confidence are in [`_work/research-market.md`](_work/research-market.md) (written by a research subagent on 2026-10-14; I re-checked the competition deadline against the announcement page myself and read the subagent's other claims as stated). The competition rules check and the deliverable mapping are in [06](06-roadmap-and-submission-plan.md).

Evidence labels: `[W]` web (URL, accessed 2026-10-14), `[?]` unverified, `[I]` inference. Rules used: a competitor capability counts only with a URL that supports it; a failed search is not evidence that a product does not exist; marketing claims are not evidence of effectiveness.

## 1. Method and limits

Five questions: (1) does any existing product or workflow already do order-level "can I afford this order, and what terms make it feasible" with a dated cash timeline; (2) what do SMEs do today and where does it break; (3) what does a strong entry look like; (4) which building blocks are reliable and cheap (answered in [03](03-system-architecture.md) section 7 and `_work/research-technical.md`); (5) which agent failure modes change a design decision (answered in [05](05-security-and-evaluation.md)).

Bounds: about 25 vendor and trade pages were fetched or searched, official pages first, at most two fetches per product. Paid accounts and demos were **not** tested. Product pages say what a vendor markets, not what works. Academic evidence on order-acceptance tools: none found (not searched deeply) `[?]`.

## 2. Product matrix

"Order-level feasibility" means: given one new order's dated cash events, existing obligations and a reserve, tell the owner whether it fits and which term changes would make it fit.

| Product | User | Verified relevant capability `[W]` | Overlap with order-level feasibility | Gap versus OrderFit's idea | Implication |
|---|---|---|---|---|---|
| Dryrun (dryrun.com) | CFOs and finance leads | combines accounting and manual inputs; models "upcoming projects", adjusts "payment timing"; compares scenarios side by side and shows "how much cash each plan needs and when" | **high** among those verified | the user builds each scenario by hand; no automatic generation of deposit, supplier-term or staged-delivery alternatives; no financing matching | a dated what-if view is not novel |
| Float (floatapp.com) | SMB owners and accountants | scenario planning, "price new hires before you commit", early warnings, Xero and QuickBooks integrations | medium | no description of an order with its own payment terms; its AI page returned 404 | same |
| Pulse (pulseapp.com) | small businesses | toggle items to test scenarios; reports by customer and project for profitability | medium | no payment-terms optimisation or financing | profitability plus cash exists |
| Cash Flow Frog | accountants, SMBs | AI connector runs scenarios by conversation; "add predicted transactions" | medium | page does not say whether an order's deposit and terms are modelled | chat what-if exists |
| Agicap | SMB and mid-market | scenario comparison, financing-need anticipation; documented approval controls for AI changes | low to medium | generic; no new-order flow described | approval gates and AI scenarios are competitive requirements |
| Centime | mid-market on ERPs | 13-week forecast from AP/AR, scenarios | low | mid-market focus | |
| Fathom (fathomhq.com) | accountants, advisors | reporting, forecasts, scenario evaluation, AI commentary | low | reporting-led | |
| Xero JAX "Cash Flow Actions" | Xero users | announced 8 to 9 July 2026: proposes plans such as delaying non-critical bills and protecting payroll, executed inside Xero; live status and scope unknown | medium on "propose a fix" | levers are bills and payroll, not an order's terms | the nearest pattern; watch it |
| Mastercard "virtual CFO" | SMBs via banks | announced March 2026: natural-language "what if" on cash flow; launch date not confirmed | medium on concept | no order-level feature stated | |
| firstbit (ERP, UAE and CIS) | ERP users | payment calendar from customer orders, purchase orders and proforma invoices; flags forecast cash gaps | medium | needs the ERP; no hypothetical-order what-if | order-driven cash calendars exist inside ERPs |
| Archdesk (construction) | contractors | forecast assembled from contracts: application dates, client payment terms, retainage | medium (project work) | construction only; no financing options | |
| Order.co | procurement teams | procure-to-close | very low | different problem | |
| Cogsy | (e-commerce inventory) | **discontinued** per its redirect page | none | | drop from the list |
| Settle, Kickfurther, Resolve, Wayflyer | CPG and B2B sellers | order and invoice financing providers (Wayflyer's page does not mention order financing) | low; they are financing *options* | not feasibility tools | OrderFit compares user-supplied terms like theirs; no marketplace |
| Bisnesy (Bangladesh) | retail and service SMEs | POS, inventory, customer-dues ledger, accounting from ৳499 a month | very low | no forecasting or order feature | Bangladeshi SMEs use POS and ledger tools `[W, low confidence]` |
| AndgateBOS, Workcel (Bangladesh) | n/a | **not confirmed**: AndgateBOS appears only as an internal project on a LinkedIn profile; Workcel's site did not respond | unknown | | cannot be cited as competitors |

## 3. Existing workarounds

A spreadsheet plus an accountant (13-week cash sheet with the new order added as rows) is the practical alternative; purchase-order financing is the usual fix for goods-based orders (fees quoted from about 2% to 5% of the financed amount by one lender-side guide and 1% to 6% per 30 days by another; the two disagree, so OrderFit hard-codes no price and uses the owner's quote) `[W: low to medium]`. Vendor blueprints for "AI cash-flow agents" forecast and flag; none verified executes `[W: low]`.

## 4. What a strong entry looks like

The International Track appears to be new in 2026 (the site says directions A to E are new or expanded this year) and no earlier International entries were found `[W: low]`, so there is nothing to learn from or avoid copying. The rubric text on the site is informative `[W: read from the site's script text, medium confidence]`: task completion = scripted tasks completed in a simulated environment; security = defence against induced transfers, data extraction, privilege escalation and prompt injection, with serious failures penalised; innovation = scenario novelty, real-world value, dialogue efficiency, clarification, correction and fallback. The domestic brief of the same organizers lists permission tiers, hallucination prevention, injection defence, audit log of the decision chain, circuit breaker, sandbox, and interrupt, rollback and human takeover as priorities. Inference `[I]`: a strong entry shows a few end-to-end scripted tasks completing in a sandbox with logs, visible safety design with tests, clarifying questions and graceful fallback, and an honest risk list. OrderFit's design maps to each of these ([01](01-requirements-scenario-edge-cases.md) section 6.2).

## 5. Commoditized features (do not call these novel)

A dated cash view for a hypothetical inflow or outflow; manual scenario comparison; customer-specific payment timing; chat-driven scenarios; source-linked numbers; approval before an AI change; supplier-deposit and invoice financing as products; spreadsheet input; "AI agent" finance templates (Anthropic published ten templates in May 2026 `[W: via the proposal's sources, not re-fetched]`). A "decision layer" label is not a differentiator either: Centime markets decision-oriented scenario answers.

## 6. Overstated claims in the earlier documents

1. The short pitch says OrderFit "decides about one specific order and compares actions, not only scenarios" as if that were unique; tools such as Dryrun let a user compare order scenarios side by side, so the novelty is the *generation and verified ranking of term changes*, not the order-level view `[R: OrderFit-Short.pdf]`.
2. The short pitch says the AI "only ranks options"; ADR 0003 and the strategy document say the engine ranks. The design now settles this: the engine ranks, and a model may never reorder an engine-verified list by default (see [ADR 0006](adrs/0006-orchestration-and-learned-layer.md)).
3. The proposal's competitor table lists products seen only in search summaries (Pilot, Ramp, Tesorio, Upflow, Airwallex T:0 and others); it labels them correctly as partial, but none was fetched here `[?]`.
4. The comparative study's "9 principal products" were checked by its authors against vendor pages; this pass confirmed the same pages and added that Cogsy is discontinued and two Bangladeshi names could not be found.
5. The system-design capacity numbers (pilot of 10,000 businesses, $0.09 per analysis, 12 to 17 seconds) are assumptions, not evidence of demand or performance.

## 7. Verdict

**Thin to partly differentiated.**

- *Not differentiated:* a dated cash timeline for an order; a manual or chat what-if; an accept-or-decline framing of the same what-if; approval gates; source links.
- *Possibly differentiated (no verified product does it; medium-low confidence because absence from about 25 pages is not proof):* automatically generating, sizing and ranking **changes to the order's commercial terms** (deposit or milestones, supplier terms, staged delivery, user-supplied financing, defer, decline), each with a before-and-after dated timeline, checked against hard constraints and profitability in one pass, with an honest "no feasible plan" and the minimum change.
- *Additive pieces that are not claims of novelty:* value-of-information questioning (ask only what flips the answer), explicit assumptions and a delay scan with "what would change the answer", text that can carry figures only through engine-resolved slots, an approval bound to the hash of the exact actions, a conversation that edits only enumerated parameters, and a per-tenant hash-chained execution log.

**What OrderFit adds, exactly:** a verified term-change search and ranking over one order, a clarification loop that is economical, and a permissioned sandbox executor with evidence. **Smallest pivot if the verdict is judged weak:** present OrderFit as an **order-terms negotiation planner**: input one order and current obligations; output three ranked counter-offers (for example "ask for a 40% deposit", "ask the supplier for 30 more days and borrow 500,000"), each with its dated timeline, the date and amount that binds, and a ready-to-send message. The design already contains every piece; the pivot changes the headline and the order of the demo, not the architecture. The competition rubric rewards safe, verifiable task completion and clarification over novelty of finance mathematics `[W]`, which lowers the cost of a thin verdict.

## 8. Manual-check list (30 minutes)

1. Rendered rules page `https://fintechathon.g-ican.com/#/en` (International tab): are the six submission items marked required or optional as the PDF says or as the site's script text says?
2. The templates under `https://fintechathon.g-ican.com/templates/` (team information form, technical document, security self-assessment, execution evidence, demo-video guide): sections, whether a passport copy or only an ID number is requested.
3. Email both `wangyr@pbcsf.tsinghua.edu.cn` and `fintechathon@ican-x.com`: which receives the registration, whether real deployment can earn the bonus on a non-on-chain topic, whether a hosted demo is allowed, which LLM APIs are permitted.
4. The detailed brief of Topic E, if any exists beyond the one-line card.
5. The Chinese rules text (the site says it prevails): deadline, bonus, required items.
6. Xero JAX Cash Flow Actions: live yet, which regions, does it model new orders (`https://www.xero.com/media-releases/xero-announces-new-ai-innovations-xerocon-london/`).
7. Dryrun, Float, Pulse and Cash Flow Frog free trials: can a deposit, milestone receipts and a supplier prepayment for a hypothetical order be entered in ten minutes?
8. Intuit's QuickBooks cash-flow planner current status; CashFlowTool still sold.
9. Where AndgateBOS and Workcel came from (exact URLs).
10. Two or three short owner or accountant conversations: how often the decision occurs and what they do.

## 9. Sources (accessed 2026-10-14)

Competition: `https://fintechathon.g-ican.com/` (script text), `https://www.its.ac.id/international/wp-content/uploads/sites/66/2026/10/PBCSF-Appendix-2-Problem-Description-and-Competition-Rules-for-International-Track.pdf`, `https://www.its.ac.id/international/2026/10/06/2026-shenzhen-fintechathon-international-track-a-fully-funded-international-competition/` (deadline, team size, nationality rule re-fetched by me), `https://r10.ieee.org/shenzhen-cis/blog/2026/06/17/2026-shenzhen-international-fintech-competition-international-track/`. Products: `https://www.dryrun.com`, `https://www.floatapp.com`, `https://www.pulseapp.com`, `https://cashflowfrog.com`, `https://www.agicap.com/en/`, `https://www.centime.com`, `https://www.fathomhq.com`, `https://www.xero.com/media-releases/xero-announces-new-ai-innovations-xerocon-london/`, `https://www.fortune.com/2026/03/10/small-businesses-cant-afford-finance-chief-mastercard-virtual-cfo-ai`, `https://userguide.firstbit.ae/x/AYM4EQ`, `https://archdesk.com/en-ae/solutions/payment-tracking`, `https://www.order.co`, `https://mayple.ai/cogsy`, `https://www.settle.com`, `https://www.kickfurther.com`, `https://www.resolvepay.com`, `https://www.wayflyer.com`, `https://www.bisnesy.com`. Practice: `https://www.kandoo.co.uk/guides/purchase-order-finance-what-is-purchase-order-finance`. Standards: `https://genai.owasp.org/llm-top-10/` (2025 list), `https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf`.
