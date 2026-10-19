# Product

<!-- impeccable:product-schema 1 -->

> Provenance: written without an interview at the user's request ("no further questions"). Facts are taken from `docs/qa_frontend_workflow_handoff.md`, `docs/ai_capability_status.md`, `docs/account_access_frontend_handoff.md`, `AGENTS.md` and `FINTECHATHON_CONTEXT.md`. Items marked **[inferred]** are not confirmed by the user and should be treated as assumptions.

## Platform

web

## Users

- **Primary:** owners and operators of small and medium businesses (manufacturers, traders, suppliers) who must decide whether they can afford a large customer order. **[inferred]** The demo narrative is a small Bangladeshi manufacturer.
- **Secondary roles inside a business:** Owner, Risk officer, Commercial lead, Auditor, Viewer. Their permissions are in the role matrix in `docs/qa_frontend_workflow_handoff.md`.
- **Platform admin:** an internal operator of the service, not a customer.

## Product Purpose

OrderFit helps a business decide whether it can afford an order, compare revised terms and financing, and record human-approved sandbox actions. Success means the owner can tell, in seconds, whether accepting an order as offered would break the cash reserve, and what terms would make it safe.

## Positioning

- A deterministic engine owns every number. AI proposes extracted facts and wording; it never calculates, never changes confirmed inputs and never approves.
- Every outgoing action (message, bundle, commitment, compensation) requires an authorized human to review the exact content and to step up their session.
- Every execution is sandbox-only. Nothing is sent to a real bank, lender, payee or email provider.

## Operating Context

- Work happens in a web browser, often on a phone or a small laptop, in a business setting where the owner juggles several documents (purchase orders, supplier offers, bank statements).
- The core journey: set a cash baseline and constraints, create or upload an order, review and confirm inputs, read the persisted evaluation and decision guide, run a separate what-if or negotiation, prepare an exact bundle, step-up approve, sandbox-execute, record acceptance, approve commit, and export the audit trail.
- Account access: sign-up, sign-in with passkeys, invitations, and (when the backend capability is on) password recovery and email verification.

## Capabilities and Constraints

- Money is integer minor units over HTTP, displayed with the declared currency. The UI must not perform financial arithmetic or derive verdicts.
- Business state, numerical verdict, review flags and background operation state are separate things and must be shown separately.
- AI capabilities are off by default and are labelled with provenance badges. Live model quality is not yet accepted.
- OCR and docx/xlsx documents are unsupported. The UI must say so.
- Real email, bank, payment and lender integrations do not exist. Any screen that implies they do is wrong.
- The current frontend is `web/` (Next.js 16 App Router, React 19, Tailwind 4).

## Brand Commitments

- Name: **OrderFit**.
- Tone: calm, plain, specific, honest about what the system did and did not do. No marketing claims that the backend does not enforce.
- The sandbox label must be visible wherever an effect is shown.

## Evidence on Hand

- Demo data and fixtures: `data/demo/`, `docs/architecture/orderfit/fixtures/`.
- Recorded AI evaluation: `data/ai_workflow/report.json`. It replays authored outputs and is not live model acceptance.
- No customer testimonials, logos, benchmarks, pricing or live-demo bookings exist. Do not invent any of them.

## Product Principles

1. Figures come from the engine and are shown as the engine produced them, with their as-of date and currency.
2. A stale, conflicting or unverified input is shown as such, never silently used.
3. Technical failures and financial verdicts are never confused.
4. Nothing looks sent, paid or saved until the system has actually committed it.
5. The next action is always visible, and every unavailable capability says why.

## Accessibility & Inclusion

- WCAG 2.2 AA for text, controls and focus in light and dark themes.
- Usable at 320 px wide and at 200% zoom; no horizontal scrolling of the page.
- Respect `prefers-reduced-motion`; the landing hero must have a static fallback.
- **[inferred]** Users may read in English or Bengali; text must not depend on Latin-only metrics.
