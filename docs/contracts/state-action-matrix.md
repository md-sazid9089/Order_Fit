# State, operation and action matrix

This freezes intended behavior. P0 does not implement state transitions or enable
commands. Permission, membership, expected row/input/business versions, unresolved
flags, exact content and real-time expiry checks always apply. `allowed_actions`
is server-derived presentation guidance, not authorization evidence.

| Deal state | Eligible use cases | Exit conditions |
|---|---|---|
| ingesting | manual draft edit, upload, parse/extract, review, close | complete enough for review -> awaiting_confirm; technical failure -> failed |
| awaiting_confirm | resolve source/candidate/coverage, edit, confirm, queue evaluation | confirmation creates immutable snapshot/T2 evidence; admitted compute -> computing; re-extract -> ingesting |
| computing | poll/cancel-at-safe-boundary, close if safe | numeric result -> awaiting_approval; missing/conflict/unsupported -> awaiting_confirm (new edge); technical failure -> failed |
| awaiting_approval | inspect result, fork what-if, edit via review, draft, acceptance, prepare bundle, approve, execute, hold/close | completed exact send batch -> awaiting_reply; accepted/approved completed sandbox commit+projection -> committed; financial edit -> awaiting_confirm |
| awaiting_reply | record/review reply, inspect, accepted-term reevaluation, hold/close, separately approved commit | changed terms -> awaiting_confirm; current same inputs -> computing; completed commit -> committed |
| committed | read/export, reconciliation, separately approved compensation | terminal; compensation does not reopen or rewrite the commercial deal |
| closed | read/export | terminal; new linked deal for another commercial attempt |
| failed | inspect technical operation/evidence, explicit retry, close | failed->ingesting then review; no source/evaluation loss |

`protocol.STATE_EDGES` contains all existing SQL transitions plus the explicit
computing->awaiting_confirm P1 addition. Status alone never makes a command legal.
A hold is a blocking flag, enforced on every remaining outgoing effect. Only
code-specific evidence/authority resolves flags; no generic bypass/override route.

| Operation status | Meaning | Recovery |
|---|---|---|
| queued | admitted transaction committed, work not yet claimed | same durable ID/key; competing workers claim once |
| running | leased with fencing token | heartbeat; expired claim can be recovered; old token cannot publish |
| succeeded | terminal job outcome; result may be completed resource or blocked domain result | retrieve same result, no duplicate calculation/effect admission |
| failed | terminal technical failure or exhausted bounded attempts | safe typed error; explicit permitted retry, preserve history |
| cancelled | stopped at safe boundary | completed effects remain visible; cannot infer rollback |

| Approval action | Tier/application role | Exact allowed items | Extra preconditions |
|---|---|---|---|
| confirm_figures | T2+, commercial/risk/owner | immutable input snapshot evidence only | complete reviewed fields, matching rebuilt snapshot/revisions |
| send_message | T3, risk/owner | bundle message items only | session-bound consumed step-up, max-round, current recipients/content |
| commit_plan | T3, risk/owner | approved message/ledger/lender items | current feasible option, exact party acceptances, serialized business gate |
| compensate | T3, risk/owner | inverse cancellation items bound to original action/hash | distinct approved bundle, current compensation conditions, inverse projection |

One approved outgoing batch increments completed negotiation round once after
all required messages finish. Partial/replayed batch does not increment twice.
Receipt/reply never increments a round or silently records cash. Selecting an
already computed option is not a financial edit; changing terms/grid/offer/source
is. Workflow versions are separate from financial revisions.

P6 extends existing single-message approval constraints/guards for exact batches;
current SQL matching a body/plan hash alone is insufficient authority. Successful
sandbox effect/status/audit share a DB transaction. Partial execution retains the
same run and durable commitment gate. Revocation/hold stops pending effects but
cannot undo completed ones. A compensation manifest never erases audit history.
