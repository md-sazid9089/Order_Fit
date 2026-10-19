# OrderFit workflow guide

This guide explains the main OrderFit workflows in plain English. It is written for a business owner or teammate who wants to understand what happens, what they need to do, and what the system does next.

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

- [Current workflow and QA handoff](qa_frontend_workflow_handoff.md) — detailed current screens, roles, and acceptance behavior.
- [Backend implementation progress](backend_implementation_progress.md) — what is implemented locally and what remains unverified.
- [Architecture documents](architecture/orderfit/README.md) — deeper product, system, and financial design.
