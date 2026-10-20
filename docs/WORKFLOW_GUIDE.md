# OrderFit workflow guide

This guide is a plain-English presentation companion for OrderFit. It explains the problem, the workflow, the architecture and AI choices, the security measures, and what a presenter can safely claim. “Everything” means the current product surface and the important design decisions, including redirects and unavailable areas; it does not mean every future or proposed feature.

## Presentation in 30 seconds

Small businesses can win a profitable order and still run short of cash because supplier bills are due before the customer pays. OrderFit puts the business's dated cash, order terms, costs, reserve, and any recorded financing offers into one reviewable assessment. A deterministic calculator checks the cash position day by day and compares supported choices. AI helps read language and propose possible inputs, but it cannot decide the numbers or approve actions. A person reviews the facts and approves any simulated action. The result is a clear, traceable answer to: **Can we take this order safely, and what would need to change?**

## A simple presentation outline

1. **Introduce the problem:** profit on paper does not guarantee enough cash on the day bills are due.
2. **Show the inputs:** starting cash and dated events, the order and its costs, the reserve, and any documented offer.
3. **Show source review:** a person checks extracted suggestions and confirms the facts.
4. **Show the assessment:** the calculator projects cash by day, tests scenarios, identifies any reserve breach, and compares supported options.
5. **Show interaction:** ask a what-if in ordinary language; AI proposes a typed change and the calculator recomputes it separately.
6. **Show human control:** review a draft, approve the exact bundle, and run it in the sandbox.
7. **Close with evidence and limits:** show the saved result and audit record, and say clearly that the action was simulated.

Use synthetic business names, addresses, documents, and financial values in a presentation. Rehearse the exact path and read the actual numbers shown by the app; do not narrate expected numbers as if they were observed.

## Architecture decisions in everyday language

| Decision | What it means | Why we chose it |
| --- | --- | --- |
| One deterministic financial engine | The same tested calculation owns cash balances, dates, reserve checks, scenario results, and rankings. | Financial answers need to be reproducible and explainable. A language model can produce plausible but incorrect arithmetic. |
| AI at specific language steps | AI can propose facts from documents, interpret a what-if, read a reply, suggest clause readings, and help phrase an explanation. | Language is where flexible interpretation helps; money calculations and permissions need stricter rules. |
| Fixed workflow instead of an autonomous agent | The app moves through explicit steps and typed jobs. The model does not choose arbitrary tools or decide what action to take. | This reduces the impact of confusing or malicious text and makes runs easier to reproduce, test, and explain. |
| Human confirmation and approval | People confirm the financial facts and separately approve exact outgoing sandbox actions. | A suggestion or a calculation should not silently become a business commitment. |
| Sandbox-only execution | The app records simulated messages and settlement actions; it has no live bank, payment, lender, or customer-mail action path. | This allows the workflow to demonstrate controls without moving real money or contacting real counterparties. |
| Durable operations and audit evidence | Long work is saved and can be reloaded after a browser disconnect. Actions and decisions leave recorded evidence. | A lost page response must not create a duplicate action or erase what happened. |
| Versioned inputs and stale-result checks | When source facts change, dependent assessments and approvals must be refreshed. | A decision based on yesterday's inputs should not be mistaken for a current decision. |

In technical terms, the product is a web app, an API, a durable worker, a PostgreSQL store, a deterministic engine, an optional model gateway, private document storage, and a simulated execution layer. The worker handles model and calculation jobs so a slow provider call does not hold a database transaction open.

## Where AI is used, exactly

AI is an optional language assistant. These capabilities are implemented in code. On 20 October 2026 the configured OpenAI model (`gpt-6-luna`) passed all 49 synthetic AI evaluation cases across the five proposal tasks, with zero unsafe proposal changes. This demonstrates the AI proposal paths on synthetic examples. It is not evidence of database-backed end-to-end operation, hosted acceptance, or production accuracy.

| AI task | What a person does | What the model proposes | What the application/person does next |
| --- | --- | --- | --- |
| Read order documents | Upload a supported document and request extraction. | Candidate fields such as order value, dates, payment terms, and costs, with an exact source quote and page when available. | Code checks that the quote exists in the source and checks for conflicts. The person confirms each fact; ambiguous or missing values stay unresolved. |
| Understand a what-if question | Type a question such as “What if the customer pays later?” | A typed list of supported scenario changes, or a clarifying question. | Bounds and supported-change rules are checked. The calculator evaluates a separate what-if fork. The person decides whether to apply it, then confirms and reassesses. |
| Read a customer reply | Paste or record the reply and its source. | Typed possible terms, conditions, unsupported clauses, and an advisory interpretation. | Quotes must match the reply. Deterministic checks decide whether acceptance is exact, whether conditions remain, and whether a bank-change or injection hold is needed. A model stance cannot declare acceptance. |
| Interpret an ambiguous clause | Ask the app to examine a clause with more than one possible reading. | A small set of quoted, typed interpretations. | The calculator evaluates each interpretation separately. The workflow asks the owner only when the choice could change the decision. No interpretation becomes fact without review. |
| Help word an explanation | Request wording for a saved result. | Sentences using named placeholders for facts already supplied by the engine. | Number and term checks reject unsupported figures or claims. A fixed template is the fallback. |

### AI boundaries to say out loud

- AI does **not** calculate profit, cash balances, feasibility, or rankings. The deterministic engine does that.
- AI does **not** edit confirmed business inputs, select a recipient, approve an action, or execute an action.
- Negotiation messages use exact-term templates; generative wording does not get to change the commercial terms.
- Model output is a proposal. It carries a source or provenance label such as live, recorded, template, typed, or manual.
- AI can be off, unavailable, unclear, or wrong. The workflow falls back to deterministic parsing or manual review where supported.
- The current workflow plan does not use retrieval-augmented generation, a vector database, or multiple agents. It also keeps future proposed capabilities separate from current ones.

### Provider and evidence choices

- The hosted provider intended for live use is OpenAI through the Responses API with structured typed output. Configuration is expected to fail closed when live mode is missing required credentials or model settings.
- Recorded mode replays authored examples. It is useful for repeatable testing and demos, but it is **not evidence of live model quality**.
- OpenAI is the only supported live model provider. The app also has off and recorded modes that make no live provider calls.
- The live evaluation passed 49 synthetic cases across five task types. These support checking schemas, fallbacks, and safety rules on those cases only; they do not prove performance on real customer documents.
- The live run does not establish persisted job recovery, hosted configuration, or production accuracy. Never present it as a database-backed or real-customer workflow test.

### Important demo-path caveat

The FinTechathon context file warns that the default **Auto** path on the new-order screen is a UI mock: it handles file names and shows hard-coded example values; it does not upload a document, call AI, or save a real assessment. For a real workflow demonstration, use the explicit **Manual Order Form** to create a saved order, or open a saved order's **Documents** page to show the backend-wired document extraction path. Confirm which path is currently enabled in the build you are presenting. Do not describe mock screens as live AI.

## Security and safety measures in plain English

| Protection | How to explain it |
| --- | --- |
| Business separation | A user's membership determines which business they can access. Requests are scoped to that business, and database row-level security provides another isolation boundary. |
| Role permissions | Viewer, auditor, commercial lead, risk officer, and owner roles have different read, preparation, source-management, audit, approval, and membership powers. The server checks permissions; hiding a button is not the security boundary. |
| Session and request protection | The app uses server-managed sessions and request protections such as CSRF checks. Sensitive approvals require a fresh password step-up. This is not the same as claiming multi-factor authentication. |
| Exact approval binding | Approval is tied to the exact action bundle and its hash, current input versions, expiry, role, and session. If a term or input changes, the old approval cannot authorize the changed action. |
| Duplicate prevention | Writes use idempotency and version checks. Retrying after a lost response should recover the same saved operation instead of creating another effect. |
| Untrusted documents and replies | Source text is treated as untrusted. Prompt-injection checks add defense in depth, while the stronger control is that model output is typed, tool-limited, grounded, and reviewed. |
| Quote and number validation | Extracted quotes must be present in the source. Generated explanation text is limited to slots and checked against saved facts so the model cannot introduce new amounts or terms. |
| Bank-change holds | A reply that asks to change payment account details is held for specific review by an owner or risk officer and requires supporting evidence. |
| Durable, tamper-evident history | Important operations are recorded in an append-only, hash-chained audit log. A verifier can detect changes in the recorded chain. This is tamper-evident, not an external legal or public timestamp anchor. |
| Private data and bounded work | Documents are private; uploads, extracted text, prompts, and provider calls have size/time bounds. Secrets should remain server-side and must not appear in screenshots or recordings. |
| No real-world effects | Execution is simulated. There is no real payment, email send, bank connection, or lender submission in the workflow described here. |

Security is layered. Prompt-injection pattern matching is not a complete defense by itself; least authority, fixed workflow, schema validation, human review, authorization checks, and sandbox-only effects matter more.

## What is implemented, designed, or still unverified

Use these labels when presenting:

- **Implemented:** code and relevant tests cover the behavior locally.
- **Recorded/synthetic:** the workflow replays authored examples or synthetic data; it does not prove live-provider or real-business performance.
- **Sandbox:** the action is simulated and has no real external effect.
- **Unverified:** no current execution evidence establishes the claim in this environment.

Current evidence notes matter: the FinTechathon context is a presentation snapshot that says its Docker daemon was unavailable, its live OpenAI path was not run, and some browser evidence predates the new-order UI change. The backend progress handoff also records that account email/recovery features default off and that no shared database migration, provider setup, live send, or deployment ran for those features. When the product is presented from a newer build, verify the current screen and environment rather than carrying old snapshot claims forward.

## Quick map of the product

| Area | What you use it for |
| --- | --- |
| Home and sign-in | Learn about the product, create an account, sign in, or recover access. |
| Overview | See a summary of the selected business and its orders. |
| Orders | Create, review, assess, compare, negotiate, and record sandbox order actions. |
| Cash Flow and Sources | Enter starting cash and dated cash events; review balances and source records. |
| Customers and Payees | Maintain customer details, recipients, lenders, and payee/account records. |
| Financing and Risk Rules | Record financing offers and choose the business's evaluation rules. |
| User Access | Let an owner invite teammates and manage membership access. |
| Audit Log | Review available history and evidence, when your role permits. |
| Settings | Review personal or business settings available to your account. |

The app also has areas that are deliberately redirects or unavailable in this release; these are listed near the end of this guide.

## The whole journey in one line

**Set up the business → add cash and order information → check the sources → confirm the facts → calculate whether the order is affordable → explore changes if needed → prepare and review a message → approve sandbox actions → record the result.**

You can stop after the assessment. Preparing a message, approving an action, and committing an order are separate optional steps.

## Before you start: set up a business

1. Create an account, sign in, or accept an invitation from a business owner.
2. Choose the business you are working in. Your role in that business determines what you can view or change.
3. Enter the business's opening cash, the date that cash figure is for, and its minimum cash reserve.
4. Add known incoming and outgoing cash events with their dates. Use the cash-flow screen to review the dated balance.
5. Add any financing offers the business wants considered. A saved offer is information for comparison; it does not mean a lender approved it.
6. Add customers and payees as needed. Record risk rules such as minimum profit or financing limits.

These business records can be updated later. Corrections create new records or revisions so the history remains understandable.

## Workflow 1: assess a new customer order

1. Open **Orders** and create a new order.
2. Enter the customer, purchase order reference, order value, important dates, payment timing, and expected costs. You can enter these by hand.
3. Optionally open the order's **Documents** area and upload a purchase order, supplier quote, or other supported source. The supported formats include text-based PDF, text, CSV, and JSON. Scanned PDFs and Word/Excel files need manual entry in this version.
4. If you uploaded a document, ask OrderFit to suggest fields from it. Check each suggestion against the displayed source text. Suggestions are not facts until a person confirms them.
5. Review the order's facts and any warnings. Fill in missing details, resolve conflicts, and acknowledge warnings when the system allows it. A serious missing or inconsistent fact may block the calculation.
6. Confirm the reviewed inputs. This saves the exact version of the information you checked.
7. Start the assessment. It may take a short time; you can return to the saved order and reload its status.
8. Read the result: whether the order fits the reserve, the lowest projected cash balance and date, estimated profit, possible plans, risks, missing information, and the assumptions used.

OrderFit's calculation uses saved, confirmed information. AI can help read documents or explain a request, but it does not decide the financial result.

## Workflow 2: add cash records from a CSV file

1. Open the business's cash sources and choose the CSV preview option.
2. Select the file and inspect the rows OrderFit understood.
3. Review any invalid rows and duplicate warnings. A preview does not change the cash records.
4. Correct the source file if needed and preview it again.
5. Confirm the preview only after the listed events look right. Confirming records the events; later corrections should be made as revisions or voids so the history is preserved.

## Workflow 3: understand the result and try a what-if

1. Start from a current order assessment. If the order inputs have changed since the assessment, run it again first.
2. Open **Prepare / Negotiate** to compare the plans the calculator evaluated.
3. Choose a supported change to explore, such as a customer deposit, later customer payment, supplier payment extension, higher costs, or one of the business's saved financing offers.
4. Review the new result as a separate what-if. It does not silently change the saved order.
5. If you want to use the scenario, apply it deliberately. Then review the changed order, confirm the new inputs, and run a fresh assessment.

The result may say that no available plan meets the business's rules. That is a valid result: review what would need to change, gather better information, negotiate different terms, or decline the order. Do not treat a technical error or a missing answer as a financial rejection.

## Workflow 4: prepare a negotiation message

This is optional. A draft is not sent automatically.

1. Start with a current assessment and select a plan or terms you want to discuss.
2. Choose a known customer or other recipient and review the exact address and proposed terms.
3. Ask OrderFit to prepare a draft, or edit the allowed wording.
4. Check every term and statement. Do not rely on a draft to establish that the other party agreed.
5. Save the draft for review. It stays unsent until the required approval workflow is completed.

## Workflow 5: record and review a customer reply

1. Open the reply area for the order and record the reply text and where it came from.
2. Review any terms OrderFit suggests it found. Check the quote against the reply itself.
3. If the reply changes price, timing, deposit, or other terms, update the proposal and reassess the order using the usual review and confirmation steps.
4. Treat a conditional or unclear reply as not yet accepted. Get clarification and record the exact agreed terms.
5. If a reply asks to change bank details, stop the normal flow. The system places a hold; an authorized risk officer or owner must verify the account and provide supporting evidence before resolving it.

## Workflow 6: approve and run a sandbox action

Only an authorized approver should do this. The current product records simulated actions; it does not send real email, move real money, or contact a real lender.

1. Make sure the assessment, selected terms, recipient, and action are current and correct.
2. Review the exact action bundle OrderFit prepared. It represents the specific message or order action being requested.
3. Re-authenticate when prompted, then approve that exact bundle. If its details change, review and approve the new version instead.
4. Run the approved action in the sandbox. Check the saved operation and audit record afterward.
5. For an order commitment, first record the other party's acceptance of the exact current terms. Then prepare and approve a separate commitment bundle.
6. Reload the order and cash view to confirm the saved result. The system prevents the same commitment from being applied twice.

Approving a negotiation message and approving an order commitment are two different decisions. Approval of one does not approve the other.

## Workflow 7: recover from a timeout or reverse a sandbox action

**If the page times out or loses connection:**

1. Do not assume the action failed or succeeded.
2. Return to the saved order and reload the operation status.
3. Retry only through the existing operation or retry control. Do not create a second action just because the first response was lost.

**If a completed sandbox action needs reversal:**

1. Open the completed action and review what happened.
2. Prepare a compensation action that describes the correction.
3. Have an authorized person review and separately approve it.
4. Confirm the new state and audit history. The original action remains in the history; compensation does not erase it.

## Other everyday workflows

- **Update cash, a customer, a payee, financing, or risk rules:** open the related business area, make the change, and review the new version. An older assessment may become out of date and need to be run again.
- **Invite a teammate:** a business owner manages invitations and roles in User Access. The invited person follows the invitation flow and signs in or creates an account.
- **Review history:** use the order evidence or Audit Log screens if your role allows it. These records help show what was reviewed, approved, and run.
- **Switch businesses:** choose the other business from the business selector. Always check the selected business before making changes.

## Workflow 8: sign up, sign in, invitations, and account recovery

### Create an account or sign in

1. Use the public home page to learn about OrderFit. Any homepage calculator or simulator is an example only; it is not saved as a business assessment.
2. If you are new, use **Sign Up** and follow the account and business setup steps shown.
3. If you already have access, use **Sign In**. Your authenticated session is managed by the app; do not share sign-in links or session information.
4. If your session expires, sign in again and reopen the selected business and order. Check the business selector before continuing.
5. To leave the app, use **Sign Out**. If the app asks you to verify your email or re-authenticate for a sensitive action, follow that prompt before continuing.

### Accept a business invitation

1. Open the invitation link from the business owner.
2. Sign in or create an account if asked.
3. Return to the invitation page and accept the one-time invitation.
4. Choose the invited business and confirm that the role shown is appropriate.
5. If the link is expired, already used, or invalid, ask the owner to issue a new invitation. Do not reuse someone else's invitation.

### Recover account access

1. From sign-in, choose the password recovery option and enter your account email.
2. If a recovery message arrives, use its link before it expires and choose a new password.
3. Follow any email verification prompt shown by the app.
4. Sign in again. If recovery cannot complete, contact the business owner or the system support owner through the approved channel.

Recovery messages may be delayed or unavailable if email delivery is not configured. The app should not reveal whether an unrelated email address has an account. Lost passkey recovery is not provided by this release.

## Workflow 9: review the overview and cash position

1. Select the correct business and open **Overview**.
2. Review the displayed order totals and statuses. Treat this as a summary of saved records, not a new calculation or approval.
3. Open **Cash Flow** to see the dated balance view based on the saved baseline and events.
4. Check the dates, event descriptions, and whether entries are confirmed, expected, or assumed.
5. If something is missing or wrong, go to Sources to add or correct it, then return to the order and reassess if its result could be affected.

Balances are for the business's configured currency. The app does not silently convert currencies or establish that a planned receipt actually arrived.

## Workflow 10: manage business sources and risk rules

1. Open **Sources** to inspect the opening cash amount, the date it applies to, and how far the business's cash records cover.
2. Add existing cash receipts and payments with a date, amount, type, direction, certainty, and source note. Review possible duplicates before confirming a matching event.
3. To fix a cash event, use the available edit or void action. A void preserves a trace; do not add a second copy to compensate without checking the history.
4. Add a lender/payee record before saving a financing offer that refers to that lender.
5. Enter the actual supported offer terms, such as eligible principal range, step size, term, fees, timing, and validity dates. Save only terms you have evidence for.
6. Open **Risk Rules** or the policy section in Sources. Review the reserve and enabled offers, then save a new policy version if the business changes its rules.
7. Revisit any order tied to an older baseline or policy. The old assessment may now be stale; confirm the intended current inputs and calculate again.

### Review a duplicate cash event before saving

1. When OrderFit identifies a possible duplicate, compare the proposed match with the source record.
2. If it is the same real obligation or receipt, resolve it as a duplicate and do not count it twice.
3. If it is a separate event, record why it is separate and review the matching details carefully.
4. If you cannot tell, leave it unresolved and ask the record owner. Do not force a choice just to proceed.

## Workflow 11: manage customers, payees, and financing records

### Customer records

1. Open **Customers** and add or update the customer's name and known business/contact details.
2. Check the domain and recipient information before selecting the customer for a negotiation draft.
3. Keep the purchase order and the actual reply as the evidence for order terms. A customer profile does not prove that a particular order was accepted.

### Payee and account records

1. Open **Payees** to add or review the party that receives a payment or provides financing.
2. Enter account details only through the protected account workflow and verify the supporting evidence.
3. Review the masked account information shown by the app. A recorded verification means a person recorded evidence; it is not a confirmation from the bank.
4. If a reply asks to change account details, stop and use the bank-change hold process described in Workflow 5.

### Financing records

1. Create or select the lender/payee record first.
2. Record the offer exactly as documented and keep its dates and status current.
3. Enable it in the business's risk policy only if it should be considered.
4. When reviewing an assessment, remember that the calculator can compare only recorded, supported offers. It does not request a loan or confirm availability.

## Workflow 12: manage team access and roles

1. A business owner opens **User Access**.
2. Invite a teammate using their email address and select the role that matches their responsibility.
3. The teammate accepts their invitation and signs in or creates an account.
4. If responsibilities change, the owner updates or revokes access using the available membership controls.
5. The teammate refreshes the app and checks the selected business and visible permissions.

Roles are intentionally different:

- **Viewer:** can read business orders and data.
- **Auditor:** can read business data and available audit history.
- **Commercial lead:** can prepare orders, what-ifs, drafts, and replies, but cannot manage financial sources or approve sandbox actions.
- **Risk officer:** can prepare, manage financial sources and rules, review audit history, and approve sandbox actions.
- **Owner:** can do the risk officer tasks and manage business membership.

Your screen may hide controls you cannot use. If an action is denied, do not try to bypass it with a direct link; ask the owner to review your role. Access is limited to the selected business.

## Workflow 13: review audit history and export evidence

1. Open the order's evidence/export controls or the **Audit Log**, if your role permits access.
2. Choose the order or available history range you need to review.
3. Read the recorded inputs, decision, approvals, action results, and timestamps together so the sequence is clear.
4. Export only the evidence needed for the review and store it in an approved location.
5. If an action seems missing, duplicated, or out of order, reload the saved operation and report the relevant order and operation reference to the system owner.

Audit history helps show what the app recorded; it is not proof that an external bank, lender, or customer performed an action. Do not share private documents, full account numbers, passwords, or session data in an issue report.

## Workflow 14: work through loading, errors, stale data, and permissions

1. **Loading:** wait for the saved page or operation to finish. If it remains pending, reload the order's saved status before starting another operation.
2. **Network or server error:** note which order/action was on screen, then reload. A lost response means the outcome is unknown until you check persisted status.
3. **Stale version warning:** refresh the order, compare the changed fields, review and confirm the current version, then run a fresh assessment. Do not approve a bundle based on an older screen.
4. **Missing or conflicting data:** return to the source, resolve it with evidence, or leave the matter for manual review. Never guess a date, amount, agreement, or account.
5. **Forbidden action:** confirm the selected business and ask an owner to check your role. Do not use another person's account.
6. **Failed or partial sandbox operation:** inspect the operation and audit record first. Follow the recovery or compensation workflow; do not repeat an action blindly.
7. **No feasible plan:** this is a financial result, not a technical failure. Consider supported term changes, request missing facts, or decline the order.

## Areas that are redirects, disabled, or unsupported

- **Orders (`/orders`)** redirects to the saved Orders area. Use saved orders; there is no separate legacy orders workflow.
- **Sandbox (`/sandbox`)** points back to Orders. Sandbox actions are part of an order's approval flow, not a separate free-form control panel.
- **Users (`/users`)** redirects to User Access. Owners manage memberships there.
- **Platform administration (`/admin` and its subpages)** is disabled in this release. There is no platform-wide user, tenant, log, security, or engine management workflow available to a business user.
- **Real email, bank, payment, and lender actions** are not connected. Approved actions are recorded in the sandbox only.
- **Scanned-document OCR and DOCX/XLSX extraction** are unsupported. Enter the relevant facts manually from the original source.
- **Foreign exchange, business-day/holiday calendars, multi-currency conversion, and multiple simultaneous orders in one calculation** are outside the current assessment scope. Do not infer or combine these in a result.
- **Unsupported financing structures or terms** cannot be invented to make a plan fit. Only supported offers saved by the business can be considered.
- **Live AI output** may be unavailable or require manual review. AI suggestions never replace confirmed inputs or the deterministic financial calculation.
- **Certain settings or account recovery operations** may depend on email/provider setup and deployment state. If the app reports unavailable, follow its manual/support path rather than assuming the operation completed.

## What to do when something is missing or blocked

1. Read the message and find which input or permission is missing.
2. If a source fact is missing, add it or mark it for manual review. Do not guess a date, cash receipt, customer agreement, or financing approval.
3. If inputs changed, review and confirm the current version, then run a new assessment.
4. If your role does not allow the action, ask the business owner to assign the right role.
5. If a technical operation is pending or failed, reload its saved status before trying again.

## A few important limits

- The financial answer comes from the deterministic calculator and the confirmed information available to it.
- Extracted fields and generated wording are suggestions for a person to review.
- A saved financing offer is not a lender commitment.
- Sandbox approval is not approval to move real money or send real communications.
- Unsupported documents and unclear terms need a manual path; OrderFit should not invent the missing facts.

## Related documents

- [Current workflow and QA handoff](workflows.md) — detailed current screens, roles, and acceptance behavior.
- [AI workflow plan](AI_WORKFLOW_PLAN.md) — AI-assisted extraction, what-if, and reply behavior and limits.
- [Backend implementation progress](backend_implementation_progress.md) — what is implemented locally and what remains unverified.
- [Architecture documents](architecture/orderfit/README.md) — deeper product, system, and financial design.
