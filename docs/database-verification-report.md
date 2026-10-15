# Database package verification report

> **Status update (2026-10-15): the schema-side and tooling findings below have been fixed.**
> This report records the review of the *original* package. The fixes are in `backend/migrations/sql/0001`–`0004`, `down_0001.sql` and `backend/migrations/env.py`:
> - G1 (pinned `search_path`, TEMP revoked)
> - G2 (cash-event kinds, `order` anchor, `assumed` certainty)
> - G3 (autogenerate disabled)
> - G6 (admin is a DB role)
> - G20–G35
> - the engine-contract fields (anchor dates, deposit concession, both stress scenarios, flat `interest_bps`, `fee_at`, `lead_days`, …)
> - `execution_action`, `notification` and `whatif_run`
>
> They are verified by the new `backend/migrations/tests/test_schema.sql` (**296/296 pass** on PostgreSQL 16, run as the real roles under RLS) and `test_concurrency.sh` (**pass**). The Alembic upgrade → downgrade → upgrade round trip is clean.
>
> Still open, because it is backend application code: G4, G5, G7–G13 and G19 (DB sessions as a member of `orderfit_app` with `set_config` per transaction, UUID ids in `domain.py`, auth, the SQLSTATE → HTTP mapping). The current design is in [database/database.md](database/database.md).

Reviewer: Claude Code (strict review, read-only on the repository). Date: 2026-10-15.
Scope: `backend/migrations/sql/0001..0004`, `down_0001.sql`, `backend/migrations/versions/0001_core_schema.py`, `docs/database/database.md`, checked against the repository code, the frontend and the design spec.

## 1. Verdict

**FITS WITH CHANGES.** The schema itself is solid. Constraints, RLS, append-only triggers and the hash chain behave as documented in almost every direct test, and it reproduces the Rina R-01/R-02 figures from stored rows. Four problems block adoption as-is. All four have small, local fixes, none of which needs a redesign:

1. **Trigger functions have no pinned `search_path`.** An `orderfit_app` session can create a TEMP table named `deal_transition`, `deal_flag` or `operation_log`. That table shadows the real one inside the triggers, which lets the session skip the state machine, skip the blocking-flag gate, or fork the audit hash chain. This was reproduced (V14, V15, V16). Fix in the schema.
2. **20 of the 22 acceptance fixtures cannot be stored.** They use the cash-event kinds `ap_payment` and `existing_inventory`, which `cash_event.kind` does not allow. OF-03 also uses the payment anchor `order`, which `payment_basis` rejects. Fix in the schema.
3. **`alembic revision --autogenerate` would drop all 25 tables.** `env.py` compares against an empty `MetaData` with `compare_type=True`. Fix in app/config.
4. **The backend has no database code, and its tenant id is not a UUID.** `current_business_id()` returns `"demo-rina"`, which cannot be cast to the schema's `uuid`. `orderfit_app` is `NOLOGIN`, and nothing sets `app.business_id`. Fix in app code, which has to be written anyway.

**Tally:** 292 checks. **PASS 225 / FAIL 64 / NOT VERIFIED 3**. Counting rules:
- Groups of identical probes are counted per probe. For example, the state machine contributes 56 pairs and tenant isolation 24 tables/views.
- 8 informational observations (INFO) are shown but not counted.
- Setup steps (k0, k4-setup, m0, o0, r0, u0) are not counted.
- Confirmation re-runs (v14c/d, v15d, v16c) are not counted.
- One invalid probe (o13, replaced by o13b) is not counted.

Of the 64 FAILs:
- 4 are BLOCKERs: G1, G2, G3, and G4 together with G5.
- About 20 are behaviours the API is expected to enforce anyway (section 5).
- The rest are HIGH, MEDIUM or LOW schema or app changes (section 4).

The scale test adds three performance findings: the RLS policy defeats indexes, `engine_input_events` scans every tenant's baseline, and a slow cold verify. Each has a measured fix.

## 2. Environment

| Item | Value |
|---|---|
| PostgreSQL | 16.15 (Debian 16.15-1.pgdg13+2), Docker image `postgres:16`, container `of-verify-pg`, bound to `127.0.0.1:55432` |
| Databases | `of_verify` (psql apply plus all probes), `of_verify_alembic` (Alembic round trip), and scratch copies made from `of_verify`: `of_rerun`, `of_tamper`, `of_scale` |
| Host OS | Windows 11 Pro 10.0.26200. Commands ran from Git Bash; `psql` and `pgbench` ran inside the container |
| Python / drivers | Python 3.14.0 (`backend/.venv`), alembic 1.20.0, SQLAlchemy 2.1.4, psycopg 3.3.6, psycopg-binary 3.3.6, psycopg-pool 3.3.3 |
| Isolation from real DBs | `DATABASE_URL` / `DATABASE_URL_DIRECT` were set explicitly to the throwaway container, and Alembic ran from a scratch directory, so no `.env` file was read. Before any migration I checked the resolved URL (`postgresql+psycopg`, `127.0.0.1:55432`, `of_verify_alembic`). No `.env` value was read or printed |
| Probe method | A `verify` schema in the throwaway DB holds `verify.try()`, which runs a statement in a subtransaction and returns `OK` or `ERR <SQLSTATE>: <message>`. Results go to `verify.results`. App-role probes ran after `SET ROLE orderfit_app` (or `orderfit_readonly`), so RLS and grants applied. Scripts are in the session scratchpad (`00_harness_fixture.sql`, `10_probes.sql`, `20_confirm.sql`, `30_scale_load.sql`, `41_rina.sql`) |

## 3. Results

**Evidence notation:**
- `0001:L` = `backend/migrations/sql/0001_core_schema.sql` line L. `0002`, `0003` and `0004` follow the same pattern.
- `rev:L` = `backend/migrations/versions/0001_core_schema.py`.
- Probe ids (a1, e, h, …) refer to rows in `verify.results`. The "Actual" column quotes the stored result.

### Part 1–2: placement, tooling, apply

| ID | Area | What was checked | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| P1 | Placement | SQL files and Alembic revision exist | 4 up files, `down_0001.sql`, `versions/0001_core_schema.py` | All present (untracked, `git status ??`) | PASS | `ls backend/migrations/sql` |
| P2 | Placement | `test_schema.sql` and `test_concurrency.sh` present | Present | **Not in the repository.** `docs/database/database.md:125-126` references `tests/test_schema.sql` and `tests/test_concurrency.sh` | FAIL | `find . -name test_schema.sql` returned nothing |
| P3 | Placement | Design doc at `docs/database.md` | That path | At `docs/database/database.md`. Its line 129 also tells users to copy from `alembic/0001_core_schema.py`, a path that does not exist | FAIL | `ls docs/database/` |
| P4 | Placement | `SQL_DIR` resolves to the sql folder | `backend/migrations/sql` | `Path(__file__).resolve().parents[1] / "sql"` resolves correctly; the upgrade read all 4 files | PASS | rev:22, Alembic upgrade output |
| P5 | Tooling | `alembic.ini` and `env.py` exist; psycopg 3 URL form | `postgresql+psycopg://` | `env.py` takes the URL from `settings.migration_url`; the default is `postgresql+psycopg://` | PASS | `backend/migrations/env.py:12`, `backend/orderfit/config.py:19,28-29` |
| P6 | Tooling | Autogenerate is harmless for these tables | No diff | `alembic check` reports `remove_table` for **all 25 tables**. `target_metadata` is an empty `MetaData` and `compare_type=True`. The design doc says to "keep compare_metadata off", but `env.py` does not | FAIL | `env.py:18,36,53`, `store/tables.py:6`; `alembic check \| grep -c "Detected removed table"` → `25` |
| P7 | Tooling | Exactly one head, no conflicting revisions | 1 head | `0001_core_schema (head)`; history `<base> -> 0001_core_schema` | PASS | `alembic heads`, `alembic history` |
| P8 | Tooling | `alembic upgrade head --sql` (offline) | Fails: the migration needs a live connection | Fails: `AttributeError: 'MockConnection' object has no attribute 'connection'` | PASS (expected failure) | rev:38 |
| P9 | Tooling | Dependencies installed vs required | alembic ≥1.14, SQLAlchemy ≥2.0.36, psycopg[binary] ≥3.2 | 1.20.0 / 2.1.4 / 3.3.6 (binary 3.3.6). No lockfile pins them (`pyproject.toml:10` comment) | PASS | `importlib.metadata` |
| P10 | Apply | 4 files with `psql -v ON_ERROR_STOP=1` on `of_verify` | No error; 25 tables, 4 views | exit 0 ×4; 25 tables, 4 views, 11 functions, 12 triggers, 20 policies | PASS | catalog counts |
| P11 | Alembic | upgrade → downgrade base → upgrade | 25 tables + `alembic_version`, 4 views; nothing left after downgrade | Up: 26 tables, 4 views. Down: 1 table (`alembic_version`), **0 functions, 0 triggers, 0 policies**, 1 composite type (alembic_version's row type). Up again: identical. Roles stay, by design (`down_0001.sql:1`) | PASS | catalog query after each step |
| P12 | Tests | `tests/test_schema.sql` → 91 ok | 91 ok, 0 fail | File not in repo | NOT VERIFIED | P2 |
| P13 | Tests | `tests/test_concurrency.sh` → 400 rows, seq 1..400 | — | File not in repo. An equivalent pgbench run passed (T1) | NOT VERIFIED | P2, T1 |
| P14 | Re-run | Run the 4 files again on a migrated DB | Clean failure, no partial change | With ON_ERROR_STOP each file stops at its first statement (`relation "currency" already exists`, …). Without ON_ERROR_STOP: 37/27/4/4 errors and **no net change** (same table, policy, trigger, currency and edge counts). Through Alembic a re-run is impossible because the version row exists, and failures roll back | PASS | scratch copy `of_rerun` |
| P15 | Grants | App rights on `alembic_version` | None or SELECT | `orderfit_app` has **INSERT, SELECT, UPDATE** on `alembic_version`. `GRANT … ON ALL TABLES` (0003:64-65) runs after Alembic has created that table | FAIL | `information_schema.role_table_grants` |

### Part 4: probes (app role unless stated; tenant A = BDT business, B = USD business)

| ID | Area | What was checked | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| a1 | Tenant | As app with tenant A, rows of another tenant visible in each of 20 tables + 4 views (B rows exist in 19 of 20 tables) | 0 everywhere | 0 in all 24 | PASS ×24 | probe a1 |
| a2 | Tenant | `app.business_id` unset | 0 rows, no error | 0 rows across all 20 tables | PASS | a2 |
| a3 | Tenant | Garbage tenant id | Error, no leak | `ERR 22P02 invalid input syntax for type uuid` | PASS | a3 |
| b1 | Tenant | Deal in A referencing a customer of B | Reject | `ERR 23503` | PASS | b1, 0001:243 |
| b2 | Tenant | cash_event in A referencing a deal of B | Reject | `ERR 23503` | PASS | b2 |
| b3 | Tenant | Approval in A referencing an **evaluation/option of B** | Reject | **OK, accepted.** The FK `(evaluation_id, option_key)` has no `business_id`, and FK checks ignore RLS | FAIL | b3, 0001:468 |
| b4 | Tenant | Approval in A referencing a **message of B** | Reject | **OK, accepted.** The FK `(message_id, message_sha256)` has no `business_id` | FAIL | b4, 0001:469 |
| b5 | Tenant | extracted_field in A referencing a document of B | Reject | `ERR 23503` | PASS | b5 |
| c1 | Tenant | Switch `set_config(...,true)` A→B inside one transaction | Report | Before: A sees 2 deals. After switch: B rows 1, A rows 0. Policies are re-evaluated per statement, so whoever controls the GUC controls the tenant | INFO | c1 |
| d1 | RLS | Tenant tables with RLS enabled **and** forced | 20 | 20 | PASS | `pg_class.relforcerowsecurity` |
| d2 | RLS | Roles that bypass RLS | Superusers / BYPASSRLS only | `postgres` only | INFO | `pg_roles` |
| d3 | RLS | Superuser with no tenant set | Sees all (bypass) | Sees all 5 deals | INFO | d3 |
| d4 | RLS | Non-superuser **table owner**, no tenant set | 0 (FORCE) | 0. With tenant A set: 4 of 5. FORCE works for owners | PASS | `d4.sql` (role created and dropped inside a rolled-back transaction) |
| e | State machine | All 56 ordered pairs of the 8 statuses via UPDATE | 21 listed edges OK; 35 others `illegal deal status transition` | 56/56 as expected | PASS ×56 | e, 0002:66-70, 0004:30-51 |
| e2 | State machine | **INSERT** a deal directly as `committed` | Reject (must start at `ingesting`) | **OK.** The trigger only guards UPDATE | FAIL | e2, 0002:98 |
| e3 | State machine | INSERT a deal directly as `awaiting_approval` | Reject | **OK** | FAIL | e3 |
| f0 | Terms gate | awaiting_confirm → computing with complete terms | OK | OK | PASS | f0 |
| f ×6 | Terms gate | → computing with NULL payment_basis / delivery_date / opening_cash_minor / order_value_minor / customer_id / payment_days | Reject each | `ERR 23514 deal_terms_present_after_confirm` ×6 | PASS ×6 | 0001:247-251 |
| g1–g2 | Flags | Open blocking flag blocks → computing; resolved flag allows | ERR then OK | ERR 23514 "unresolved blocking flags"; then OK | PASS ×2 | 0002:72-76 |
| g3–g5 | Flags | Non-blocking flag doesn't block; blocking flag blocks awaiting_approval→awaiting_reply; resolved_at without resolved_by | OK / ERR / ERR | As expected | PASS ×3 | g3-g5 |
| h ×4 | Frozen inputs | While computing, edit order_value_minor, opening_cash_minor, reserve_minor, start_date | Reject | `ERR 23514 deal inputs are frozen` ×4 | PASS ×4 | 0002:87-95 |
| h ×7 | Frozen inputs | While computing, edit **payment_days, payment_basis, delivery_date, customer_id, currency, target_scenario**; payment_days while awaiting_approval | Reject (all are engine inputs) | **OK ×7.** The frozen list at 0002:88-92 covers only 5 columns | FAIL ×7 | h |
| h+ | Frozen inputs | po_number while computing; caller sets `version=99` | OK; version forced to OLD+1 | OK; version = 2 | PASS ×2 | h |
| hC | Concurrency | Two sessions update the same deal with `WHERE version = v` | Second updates 0 rows | Session 2 blocked about 2.7 s until session 1 committed, then `UPDATE 0`. Without the version predicate, last write wins silently (`S4 v4`) | PASS | two concurrent `psql` sessions |
| i1–i4 | Round | 0→2, 0→1, 1→0, 3→4 | ERR / OK / ERR / ERR | As expected | PASS ×4 | 0002:81-84 |
| i5 | Round | INSERT a deal with round 3 directly | Reject | **OK** (INSERT not guarded) | FAIL | i5 |
| j1–j6 | Money | amount 0, −5, bigint max, max+1, currency XYZ, `usd` | ERR / ERR / OK / ERR 22003 / ERR / ERR | As expected | PASS ×6 | j1–j6 |
| j7 | Money | Deal currency USD in a **BDT** business | Reject | **OK.** Nothing ties `deal.currency` to `business.currency`, and `cash_event` has no currency, so baseline events are implicitly in the business currency | FAIL | j7, 0001:220 |
| j8–j13 | Money | order value 0; reserve −1; invoice paid > amount; min > max; negative opening cash (documented); `limit_minor` = bigint max | ERR ×4, OK, OK | As expected | PASS ×6 | j8–j13 |
| k1 | Dates | delivery_date before start_date, then → computing | Reject | **OK** | FAIL | k1 |
| k2–k4 | Dates | 2028-02-29 accepted; 2027-02-29 rejected; day offset 2028-02-28→03-01 | OK / ERR 22008 / 2 | As expected | PASS ×3 | k2–k4 |
| k5–k6, k8 | Dates | Event 9999-12-31, event 0001-01-01, delivery 9999-12-31 | Accepted | Accepted. Both events are **silently dropped** from `engine_input_events` (0..540 window, 0002:214-215) | PASS ×3 (+INFO) | k5, k6, k8 |
| k7a | Dates | cash_event date `infinity` | Reject | **OK, accepted** | FAIL | k7a |
| k7b | Dates | One baseline `infinity` row, then read `engine_input_events` for another deal | View keeps working | **ERR 22008 cannot subtract infinite dates.** One bad baseline row breaks the engine view for every deal of the business | FAIL | k7b, 0002:209 |
| l1 | Ordering | `engine_input_events` orders outflows before inflows on the same day | Defined order | The view has **no ORDER BY**. The engine must sort, but the view does expose `direction` and `day` | FAIL | `pg_get_viewdef`, 0002:206-215 |
| m0–m5 | Evaluation | Second live eval; supersede then insert; app UPDATE verdict; superseded_at twice; app DELETE | ERR 23505 / OK / 42501 / 23000 / 42501 | As expected | PASS ×5 | 0001:373, 0002:30-43, 0003:72-73 |
| m6 | Evaluation | Inputs revert A→B→A: supersede, insert an eval with an earlier input_hash | OK (re-evaluate) | **ERR 23505 `evaluation_deal_id_input_hash_engine_version_key`.** A deal can never get a live evaluation for inputs it had before | FAIL | m6, 0001:366 |
| m7 | Evaluation | plan_recommended without its option row (deferred FK forced) | ERR 23503 | ERR 23503 | PASS | 0001:390-393 |
| m8 | Evaluation | Evaluation round 1 on a deal at negotiation_round 0 | Reject | **OK** | FAIL | m8 |
| n1–n6 | Immutability | App UPDATE/DELETE on evaluation_option, approval, owner_constraints | 42501 | 42501 ×6 | PASS ×6 | 0003:72 |
| S1–S5 | Immutability | Superuser UPDATE/DELETE on evaluation, evaluation_option, approval, owner_constraints | 23000 (trigger) | 23000 ×5 | PASS ×5 | 0002:22-43 |
| S10–S11 | Immutability | Superuser `TRUNCATE approval CASCADE` / `TRUNCATE evaluation CASCADE` | Blocked like operation_log | **Succeeds.** Only operation_log has a TRUNCATE trigger | FAIL ×2 | 0002:22-27 vs 168-169 |
| o1–o4 | Approval | Approve with correct sha; edit approved body; wrong sha; approver from another business | OK / ERR 23503 ×3 | As expected | PASS ×4 | 0001:467,469 |
| o5 | Approval | Approver role below tier (commercial_lead, T2) | Reject (or API) | **OK** | FAIL (API must) | o5 |
| o6 | Approval | Approver is a suspended user | Reject (or API) | **OK** | FAIL (API must) | o6 |
| o7 | Approval | `UPDATE negotiation_message SET body_sha256 = <other>` without changing the body | Reject | **OK.** The trigger fires only on `UPDATE OF body` (0002:108), so the stored hash can disagree with the body | FAIL | o7 |
| o8 | Approval | Approval on deal A1 for a message of deal A2 | Reject | **OK** | FAIL | o8 |
| o9 | Approval | send_message approval with no `step_up_verified_at` (spec requires step-up) | Reject | **OK** | FAIL | o9, 0001:462 |
| o10 | Approval | Mark an unapproved outbound message `sent` | Reject | **OK** | FAIL (API must) | o10 |
| o11 | Approval | Option key that doesn't exist | ERR 23503 | ERR 23503 | PASS | o11 |
| o12 | Approval | Approval for deal A2 citing an evaluation of deal A1 | Reject | **OK** | FAIL | o12 |
| o13b | Approval | Approval against a **superseded** evaluation | Reject | **OK** | FAIL | o13b |
| p1–p4 | Idempotency | Same approval key twice in A; same key in B; idempotency_key duplicate; same key across businesses | 23505 / OK / 23505 / OK | As expected | PASS ×4 | 0001:465,496 |
| q1–q2 | Staleness | `approval_staleness.is_stale` before and after superseding | false → true | false → true | PASS ×2 | 0002:254-258 |
| r0–r3 | Audit | Append 5; verify; forged seq/prev/hash/created_at overwritten; app writes a platform (NULL business) row | ok / overwritten / 42501 | `true/5`; `6 true`; `ERR 42501 row-level security` | PASS ×3 | 0002:144-164 |
| r4 | Audit | Tenant A calls `verify_operation_log(B)` | Report | `ok=t rows_checked=0`: a misleading "ok" for an invisible chain | INFO | r4 |
| rT1 | Audit | Superuser edits one byte of seq 150 (scratch copy, trigger disabled) | Detected at 150 | `ok=false broken_seq=150 row content does not match its hash` | PASS | `of_tamper` |
| rT2 | Audit | Delete the **newest** row | Not detected (known limitation) | `ok=true rows=419`, confirmed undetected | PASS (limitation confirmed) | `of_tamper` |
| rT3 | Audit | Delete a middle row | Detected | `ok=false broken_seq=201 gap or reordering` | PASS | `of_tamper` |
| s1–s3 | Audit | App UPDATE/DELETE/TRUNCATE operation_log | 42501 | 42501 ×3 | PASS ×3 | 0003:72 |
| S6–S9 | Audit | Superuser UPDATE/DELETE/TRUNCATE/TRUNCATE CASCADE operation_log | 23000 | 23000 ×4 | PASS ×4 | 0002:166-169 |
| T1 | Concurrency | pgbench 8 clients × 50, one business | 400 rows, seq 1..400, chain ok | 400/400 processed, 0 failed; seq 1..400, 400 distinct; `verify → true rows=400` | PASS | pgbench in container |
| T2 | Concurrency | pgbench 8 × 50 interleaved across A and B | Independent chains, no cross-blocking | 400/400, 0 failed, 182 tps; A `true rows=207`, B `true rows=200` | PASS | pgbench |
| T3 | Concurrency | Writers in `REPEATABLE READ` | Not specified | Clients abort with `23505 operation_log_scope_seq_key`, because the trigger's SELECT uses the transaction snapshot. The chain is never corrupted (`verify → true`), but logging fails | FAIL (LOW) | pgbench `rr.sql` |
| u1–u6, u8 | Documents | 25MB+1, exactly 25MB, 0, −1, `image/png`, `application/PDF`, duplicate sha in same deal, 31-byte hash | ERR / OK / ERR / ERR / ERR / ERR / 23505 / ERR | As expected | PASS ×8 | 0001:264-275 |
| u7 | Documents | Same sha256 in another deal of the same business (repo says dedupe per business) | Reject or flag | **OK.** Uniqueness is per deal (0001:275) vs per business (`domain.py:7-8`, `store/documents.py:2`) | FAIL | u7 |
| u9–u11 | Fields | confidence −0.1, 1.1, 0.9996 | ERR / ERR / OK (stored 1.000) | As expected | PASS ×3 | 0001:291 |
| u12–u13 | Fields | value `""` / JSON `null` | Reject | **OK ×2** | FAIL ×2 | 0001:288 |
| u14 | Fields | Field of deal A1 citing a document of deal A2 | Reject | **OK** | FAIL | 0001:298-299 |
| u15 | Fields | status `ambiguous` (spec vocabulary) | Representable | `ERR 23514`: the status set is {extracted, confirmed, overridden, rejected}. Spec's ambiguous/missing/conflicting do not exist | FAIL | 0001:292 vs spec 04 §10.2 |
| v1–v8 | Privileges | App DROP, ALTER, TRUNCATE, CREATE in public, read pg_authid, DELETE deal, write currency, write deal_transition | 42501 | 42501 ×8 | PASS ×8 | v1–v8 |
| v9 | Privileges | App sets `app.business_id` to B itself | Report | B deals visible: 1. Inherent to GUC-based RLS: it guards against a missed WHERE clause, not against a compromised or SQL-injected app session | INFO | v9 |
| v10 | Privileges | App sets `app.is_platform_admin=on` itself | Report | Sees both businesses. **Any** app session can self-elevate to cross-tenant | INFO (feeds gap G6) | v10 |
| v11 | Privileges | App reads users with no membership in its tenant, including `password_hash` | 0 | **2** (all 5 users readable) | FAIL | v11, 0003:48-49,64 |
| v12 | Privileges | App sets `is_platform_admin=true` on a user | Reject | **OK** | FAIL | v12, 0003:65 |
| v13 | Privileges | App changes a membership role (lead → owner) | Reject (or step-up) | **OK** | FAIL | v13 |
| **v14** | Function abuse | `CREATE TEMP TABLE deal_transition` with row (ingesting, committed), then UPDATE | ERR 23514 | **OK. Control without the temp table → ERR 23514. With it, the row really ends `committed`** | **FAIL (BLOCKER)** | v14, v14c, v14d; 0002:67 |
| **v15** | Function abuse | `CREATE TEMP TABLE deal_flag` (empty), then move a deal with an open SEC-FRAUD flag to computing | ERR 23514 | **OK. The row ends `computing` with the open fraud flag** | **FAIL (BLOCKER)** | v15, v15d; 0002:73 |
| **v16** | Function abuse | `CREATE TEMP TABLE operation_log` with a fake head, then a real insert | Chain intact | **Chain broken.** The trigger read the fake head and wrote a wrong prev_hash. Control without the temp table → `true` | **FAIL (BLOCKER)** | v16, v16c; 0002:151 |
| w1–w5, w7 | Readonly | INSERT, UPDATE, DELETE, UPDATE app_user, INSERT operation_log; tenant-scoped read | 42501 ×5; 0 foreign rows | As expected | PASS ×6 | w |
| w6 | Readonly | Readonly role reads `app_user.password_hash` | 0 | **5** | FAIL | w6 |
| x1–x2 | Text | Bangla, emoji and RTL round trip; 10.5 MB body with hash check | OK | OK; round trip equal; hash matches | PASS ×3 | x1, x1b, x2 |
| x3–x4 | Text | NUL in text; `\u0000` in jsonb | Clean reject | `ERR 54000 null character not permitted`; `ERR 22P05` | PASS ×2 | x3, x4 |
| x5 | Text | Injection-looking text stored verbatim | OK, verbatim, deal table intact | OK, verbatim | PASS ×2 | x5, x5b |
| R1 | Engine contract | Rina R-01 from stored rows via `engine_input_events` (outflows first) | Lowest $13,000 on day 60 | `lowest=1300000 on day 60 (2026-05-01)` | PASS | `41_rina.sql` |
| R2 | Engine contract | Rina R-02 accept as offered | Lowest $2,000 on day 30; $3,000 short of the $5,000 reserve | `lowest=200000 on day 30 (2026-04-01); first day below reserve: 30` | PASS | `41_rina.sql` |
| R3 | Engine contract | Rina: $9,000 loan costs $370, survives 26 days late | — | Engine financing maths; the schema only stores the result | NOT VERIFIED | needs the engine |
| R4 | Engine contract | Rina numbers asserted in backend tests | Present | `backend/tests/engine/test_rina.py` is a docstring only; `data/demo/rina_business.json` has null values | FAIL | `test_rina.py:1` |
| F1 | Engine contract | All 22 fixtures' cash-event kinds storable | Yes | **20 of 22 use `ap_payment`** (OF-04 and OF-10 also use `existing_inventory`). Insert → `ERR 23514 cash_event_kind_check` | FAIL (BLOCKER) | 0001:318-320; `fixtures/cases/*.json` |
| F2 | Engine contract | Fixture payment anchors storable | delivery, invoice, order, unknown | `order` (OF-03) is rejected by `payment_basis IN ('invoice','delivery')` | FAIL | 0001:232 |

### Part 4y: scale

**Data set** (DB `of_scale`, generated with `generate_series`):
- 50 businesses with 20 customers each.
- 200,005 deals.
- 2,000,007 cash events: 9 per deal plus 4,000 baseline events per business.
- 200,004 live evaluations, 500,001 invoices and 50k flags.
- 1,000,827 operation_log rows (20,000 per business, all through the chain trigger).

**Load times:**

| Step | Time |
|---|---|
| deals | 1m28s |
| 1.8M deal cash events | 7m52s |
| evaluations | 1m00s |
| invoices | 1m45s |
| 1M chained log rows | 5m21s (≈3.1k rows/s in one statement) |

**Environment caveat:** Docker Desktop / WSL2 VM with 3.5 GB RAM and about 100 MB free. Cold runs are dominated by disk I/O, so treat the **plan shape** as the finding and the milliseconds as indicative. Each query ran as `orderfit_app` with RLS on, tenant = business 1.

| ID | Query | Plan finding | Cold / warm | Status | Fix measured in a scratch object |
|---|---|---|---|---|---|
| Y1 | Load at the target volumes | All inserts succeed; the chain is valid (`verify → t, 20000`) | — | PASS | — |
| Y2 | `deal_pipeline` newest 50 for one business | **Seq Scan on deal (Rows Removed by Filter: 196005)** and **on evaluation (196004)**. The policy predicate `(business_id = $x) OR $admin` cannot use an index | 8.0 s / 0.14 s | FAIL | Adding an explicit `WHERE business_id = :id` lets the planner use `deal_business_id_id_key` (Bitmap Index Scan). `evaluation` still seq-scans because it has no index leading with `business_id`. Root fix: G6 (separate admin role, so the policy is a plain equality) |
| Y3 | `engine_input_events` for one deal | **Bitmap Index Scan on `cash_event_baseline_idx` returns 200,005 rows: every tenant's baseline events.** `business_id` filters only afterwards. The `e.deal_id IS NULL OR e.deal_id = d.id` join defeats the index | 3.5–8.9 s / 50 ms | FAIL | A UNION ALL rewrite (baseline branch + deal branch) returns the **same rows** (checked) and uses `Index Cond: (business_id = d.business_id AND event_date >= d.start_date)`: **10.7 ms** |
| Y4 | `customer_payment_stats` for one customer | Index scans on `customer_pkey` and `customer_invoice_customer_idx`, 500 rows | 0.74–0.81 s (cold) | PASS | — |
| Y5 | `verify_operation_log` for one business (20,000 rows) | Row-by-row PL/pgSQL loop; inner query uses `operation_log_scope_seq_key` | 31–35 s cold / 1.6 s warm | PASS (LOW note) | A single set-based statement (window `lag`) gives the same result in **0.48 s** warm. At 1M rows per tenant the loop would take minutes |
| Y6 | Deals of one customer (`customer_id` lookup) | **Seq Scan on deal (Rows Removed 199805)**: no index on `(business_id, customer_id)`, and the RLS OR again | 3.7–8.2 s | FAIL | With an explicit business filter: Bitmap Index Scan, **10 ms**. Add an index on `deal (business_id, customer_id)` |

### Part 5: schema hygiene (catalog queries)

| ID | What was checked | Expected | Actual | Status |
|---|---|---|---|---|
| H1 | Tables without a primary key | 0 | 0 | PASS |
| H2 | FKs without an index that leads with the FK columns | 0 | **37.** Most are composite `(business_id, x)` FKs where an index on `x` alone exists, and parents are never deleted (no DELETE grant), so the practical impact is low. Notable: `deal(business_id, customer_id)` (customer history), `approval(evaluation_id, option_key)`, `cash_event(business_id, customer_id/payee_id)`. Full list below | FAIL (LOW) |
| H3 | timestamp without time zone | 0 | 0 | PASS |
| H4 | Tenant tables with RLS enabled but not forced | 0 | 0 | PASS |
| H5 | Tables without RLS that hold tenant data | `app_user` only | `app_user`, plus the reference tables `app_role`, `currency`, `deal_status`, `deal_transition`, which are not tenant data | PASS |
| H6 | SECURITY DEFINER functions | Report | None (all 11 are SECURITY INVOKER) | PASS |
| H7 | `search_path` pinned on functions | Pinned | **None of the 11 has a `SET search_path`.** All trigger functions use unqualified table names, which is exploitable (V14–V16) | FAIL (BLOCKER) |
| H8 | Every policy uses `(SELECT app_business_id())` | 20/20 | 20/20, e.g. `((business_id = ( SELECT app_business_id() …)) OR ( SELECT app_is_platform_admin() …))` | PASS |
| H9 | Unused or duplicate indexes | None | `document_deal_idx (deal_id)` duplicates the leading column of `UNIQUE (deal_id, content_hash)` | FAIL (LOW) |
| H10 | Text columns without a CHECK where one is sensible | — | `business.timezone` (any string; should be validated against `pg_timezone_names` or by the app); `negotiation_message.body` (no size cap, 10.5 MB accepted); `approval.idempotency_key` and `idempotency_key.scope` (no length cap); `evaluation.engine_version` (free text) | FAIL (LOW) |
| H11 | Nullable columns that should be NOT NULL | — | `negotiation_message.body_sha256` (the app can set it to NULL or to any value, o7); `approval.step_up_verified_at` for send/commit (o9); `deal.target_scenario` (an engine input, nullable with no default); `operation_log.tier`; `owner_constraints.downside_*` (required by the engine for the downside scenario, yet nullable while `target_scenario` may be `downside`) | FAIL (LOW) |

H2 full list:
- `deal_transition.to_status`
- `business.currency`
- `membership.role`
- `payee_bank_account(business_id,payee_id)`, `payee_bank_account.verified_by`
- `owner_constraints.created_by`
- `deal(business_id,constraints_id)`, `deal(business_id,customer_id)`, `deal.created_by`, `deal.currency`, `deal.status`
- `document(business_id,deal_id)`, `document.uploaded_by`
- `extracted_field(business_id,deal_id)`, `extracted_field(business_id,document_id)`, `extracted_field.confirmed_by`
- `cash_event(business_id,customer_id|deal_id|payee_id|source_document_id)`
- `evaluation(business_id,deal_id)`, `evaluation(id,recommended_option_key)`
- `evaluation_option(business_id,evaluation_id)`
- `deal_flag(business_id,deal_id)`, `deal_flag.resolved_by`
- `negotiation_message(business_id,deal_id|source_document_id)`, `negotiation_message.created_by`
- `approval(approver_id,business_id)`, `approval(business_id,deal_id)`, `approval(evaluation_id,option_key)`, `approval(message_id,message_sha256)`
- `sandbox_action(business_id,deal_id)`, `sandbox_action.user_id`
- `operation_log.actor_user_id`, `operation_log(business_id,deal_id)`, `operation_log.business_id`

### Part 3: fit with the existing code (summary rows; details in section 4)

| ID | Area | What was checked | Status | Evidence |
|---|---|---|---|---|
| F8 | Backend domain | Every `domain.py` / `engine/models.py` entity mapped to table.column | FAIL (gaps G7–G13) | `backend/orderfit/domain.py`, `engine/models.py` |
| F9 | Status vocabulary | Every status string in code, frontend and spec representable | FAIL (gaps G14–G17) | see section 4 |
| F10 | Frontend | Every displayed or submitted field has a home; role names | Roles PASS (all 6 seeded, 0004:9-15); fields FAIL (gap G18) | frontend files cited in G18 |
| F11 | Engine contract | Money in integer minor units end to end; day derivable from dates | PASS (R1, R2, k4); kinds and anchor FAIL (F1, F2) | 0002:209 |
| F12 | Connection model | Sessions, role, `set_config` per transaction | FAIL (gap G3, G4, G5) | no DB code exists |
| F13 | Auth | Users and tenants identified; multi-business | FAIL (gap G4) | `api/deps.py:9-10`, frontend fake sign-in |
| F14 | Idempotency and errors | Key generation, sha pinning, SQLSTATE → HTTP | FAIL (gap G19) | no route code exists |
| CK1 | LangGraph checkpointer | App role can create and write checkpoint tables created after the migration | FAIL (gap G5b) | Simulated `CREATE TABLE public.checkpoints` as the migrator: `orderfit_app select=true insert=false update=false delete=false`; `CREATE on public: false` |

## 4. Fit gaps

Severity: **BLOCKER** = must change before the schema can be used with this repo. **HIGH** = wrong behaviour or security exposure. **MEDIUM** = missing capability the spec or UI needs. **LOW** = hygiene.

### Schema-side gaps

| # | Gap | Repo side | Schema side | Severity | Smallest change | Where |
|---|---|---|---|---|---|---|
| G1 | Trigger functions resolve unqualified tables via the caller's `search_path`; `pg_temp` is searched first, and `orderfit_app` has TEMPORARY | — | `deal_guard` (0002:67,73), `operation_log_chain` (0002:151), `verify_operation_log` (0002:185), `deal_defaults` (0002:51,54), the views | **BLOCKER** | Add `SET search_path = pg_catalog, public, pg_temp` to every function (`ALTER FUNCTION … SET search_path …`) **and/or** schema-qualify every table reference. Also `REVOKE TEMPORARY ON DATABASE <db> FROM PUBLIC` and grant TEMP only where needed | schema |
| G2 | Acceptance fixtures use cash-event kinds and an anchor the schema rejects | `fixtures/cases/*.json`: `ap_payment` (20/22), `existing_inventory` (OF-04, OF-10), anchor `order` (OF-03). Spec 04 §10.2 lists 16 kinds, including `order_deposit, order_final_receipt, loan_draw, loan_fee, loan_interest, loan_repayment`. The engine model mentions `receipt, loan_draw, loan_repayment` (`engine/models.py:31`) | `cash_event.kind` CHECK (0001:318-320); `deal.payment_basis` (0001:232); `certainty` lacks spec value `assumed` (0001:321) | **BLOCKER** | Move `kind` to a lookup table seeded with the union of spec, fixture and schema kinds (the file header already prefers lookup tables). Add `'order'` to `payment_basis`. Add `'assumed'` to `certainty` | schema |
| G6 | `app.is_platform_admin` is a plain GUC any session can set | — | Policies (0003:36-37) | HIGH | Make platform admin a separate DB role (e.g. `orderfit_admin` with BYPASSRLS, or a policy `TO orderfit_admin`) instead of a GUC the app role can set | schema |
| G20 | Cross-tenant and cross-deal FK holes in approval and extracted_field | — | `approval (evaluation_id, option_key)` (0001:468) and `(message_id, message_sha256)` (0001:469) lack `business_id` and `deal_id`; `extracted_field` document FK doesn't tie the document to the same deal (0001:299); `approval` accepted against a superseded evaluation (o13b) | HIGH | Add `deal_id` (and `business_id`) to the referenced unique keys and FKs: `evaluation_option` gets `deal_id`, FK `(business_id, deal_id, evaluation_id, option_key)`; message FK `(business_id, deal_id, id, body_sha256)`; document FK `(business_id, deal_id, id)`. Refusing superseded evaluations needs a trigger, or the API | schema |
| G21 | Frozen-input list incomplete | Spec: inputs versioned, evaluations stale on change | 0002:87-92 freeze only 5 columns; `payment_days, payment_basis, delivery_date, customer_id, currency, target_scenario` stay editable after compute (7 FAILs) | HIGH | Add those columns to the frozen list (or freeze "every engine input column") | schema |
| G22 | INSERT bypasses the workflow guard | — | `deal_guard` is BEFORE UPDATE only (0002:98). A deal can be inserted as `committed`, `awaiting_approval`, round 3 | HIGH | Add a BEFORE INSERT check: `status = 'ingesting' AND negotiation_round = 0` (allow other values only for migrations or seed, via a role check) | schema |
| G23 | `app_user` exposed: password hashes readable, `is_platform_admin` writable by the app; membership role writable | — | 0003:48-49, 64-65 grant SELECT/INSERT/UPDATE on all tables including `app_user` | HIGH | Revoke SELECT on `app_user.password_hash` from `orderfit_app` and `orderfit_readonly` (column grants), or move credentials to a separate table only an auth role can read. Revoke UPDATE on `app_user.is_platform_admin` and on `membership.role` from the app role, or gate them with a trigger | schema |
| G24 | `body_sha256` can be overwritten directly | — | Trigger is `BEFORE INSERT OR UPDATE OF body` (0002:108) | MEDIUM | Make the trigger fire on any UPDATE (always recompute), or turn `body_sha256` into `GENERATED ALWAYS AS (sha256(convert_to(body,'UTF8'))) STORED` | schema |
| G25 | Evaluation uniqueness blocks re-evaluating earlier inputs | Spec: re-run must reproduce; owner may revert an edit | `UNIQUE (deal_id, input_hash, engine_version)` (0001:366) also covers superseded rows (m6) | MEDIUM | Make it a partial unique index `WHERE superseded_at IS NULL`, or let the API reuse an existing row (impossible today, since superseded rows cannot be un-superseded) | schema |
| G26 | `infinity` dates accepted and break `engine_input_events` for the whole business | — | `cash_event.event_date`, `deal.start_date`, `delivery_date` | MEDIUM | `CHECK (event_date BETWEEN '2000-01-01' AND '2100-12-31')` (or `isfinite(event_date)`) on every `date` column | schema |
| G27 | Deal currency not tied to business currency; baseline events carry no currency | Spec: one currency per deal / business | 0001:220, 311-337 | MEDIUM | Either drop `deal.currency` (use the business currency) or add a trigger or FK `(business_id, currency)` to `business(id, currency)` | schema |
| G28 | Spec entities and states with no home | Spec 04 §10.2: `sandbox_action` = simulated bank / outbox / lender (`ledger_entry, message, lender_acceptance, cancellation`; statuses `drafted…failed`); approval `kind` includes `compensate`, approval `status` valid/voided/used, `expires_at`; operation_log outcome `attempted`; extracted_field status ambiguous/missing/conflicting; `business.synthetic` required for live mode | Schema `sandbox_action` is a what-if log (0001:476-485); approval actions lack `compensate`, there is no `status`/`expires_at`; outcome set (0002:127) lacks `attempted`; extracted status (0001:292) | MEDIUM | Add an `execution_action` table (or rename), add approval `status` and `expires_at`, add `attempted`, extend the extracted_field status vocabulary. Decide whether the 15-state spec machine (G14) replaces the 8-state one | schema (and a design decision) |
| G29 | No TRUNCATE guard on the other append-only tables | — | Only operation_log has a statement trigger (0002:168-169); `TRUNCATE approval/evaluation CASCADE` succeeds for the owner or superuser | LOW | Add `BEFORE TRUNCATE … forbid_change()` to approval, evaluation, evaluation_option, owner_constraints | schema |
| G30 | Hash-chain writers fail under REPEATABLE READ | — | 0002:151 reads the head with the transaction snapshot | LOW | Document "log under READ COMMITTED", or take the head with `SELECT … FOR UPDATE` on a per-scope head table | schema/app |
| G31 | App role can write `alembic_version` | — | 0003:64-65 | LOW | `REVOKE INSERT, UPDATE ON alembic_version FROM orderfit_app` at the end of 0003 | schema |
| G32 | Engine window silently drops events outside 0..540 days and before `start_date` | Spec W-BASELINE-COVERAGE warning | 0002:214-215 | LOW | Expose a second view (or count) of out-of-window events so the API can raise the warning | schema |
| G33 | `engine_input_events` scans every tenant's baseline events | Engine input per deal | 0002:213 join `e.deal_id IS NULL OR e.deal_id = d.id` (Y3) | HIGH (scale) | Rewrite as `UNION ALL` of a baseline branch and a deal branch: same rows, 10.7 ms vs seconds | schema |
| G34 | RLS policy `… OR app_is_platform_admin()` defeats indexes; no index leads with `business_id` on `evaluation`; no `(business_id, customer_id)` index on `deal` | All list pages | 0003:36-37; 0001:254, 373 (Y2, Y6) | MEDIUM (scale) | Fix G6 so the policy is a plain equality; add `evaluation (business_id, deal_id) WHERE superseded_at IS NULL` and `deal (business_id, customer_id)`. The API should also always add an explicit `WHERE business_id = :id` | schema + app |
| G35 | `verify_operation_log` loops row by row | "Verify Hash Chain" button | 0002:175-198 (Y5) | LOW | A set-based single statement (window `lag`) is about 3× faster warm, with the same checks | schema |

### App-side gaps

| # | Gap | Repo side | Schema side | Severity | Smallest change | Where |
|---|---|---|---|---|---|---|
| G3 | Autogenerate drops the schema | `backend/migrations/env.py:18,36,53` (`target_metadata = metadata`, empty; `compare_type=True`); `store/tables.py:6-14` | 25 raw-SQL tables | **BLOCKER** | In `env.py` set `target_metadata = None` (or an `include_object` that returns False for every table not in `metadata`). Alternatively reflect the tables into `metadata` | app/config |
| G4 | Tenant id is a string, and there is no auth | `api/deps.py:9-10` returns `"demo-rina"`; every `domain.py` id is `str` (`business_id` 60, 71, 107, 124, 140; `deal_id` 106; `customer_id` 70, 108); frontend sign-in is a `setTimeout` (`frontend/app/auth/signin/page.tsx:13-21`) | `business.id uuid`; `app_business_id()` casts to uuid (0003:14-16), so `'demo-rina'` raises 22P02 | **BLOCKER** | Seed `demo-rina` as a uuid business with `public_ref` or slug `demo-rina`, and resolve the slug to the uuid in `current_business_id()`. Change ids in `domain.py` to `UUID`. Real auth: session → `app_user` + `membership` (the schema supports several businesses per user; code assumes one) | app |
| G5 | No connection model | No `create_engine` / session / `set_config` anywhere in `backend/` (grep returned nothing); `store/db.py` is a docstring; `store/checkpoint.py:4-6` plans `autocommit=True` | `orderfit_app` is `NOLOGIN` (0003:59); policies need `app.business_id` per transaction (0003:3-7) | **BLOCKER** | (1) Create a LOGIN role (e.g. `orderfit_api`) per environment, `GRANT orderfit_app TO orderfit_api`, and use it in `DATABASE_URL`. Keep the owner/migrator only in `DATABASE_URL_DIRECT`. (2) Wrap every request in an explicit transaction and run `SELECT set_config('app.business_id', :id, true)` first. With `autocommit=True` the transaction-local setting is lost after one statement. This is fine with Neon's PgBouncer transaction pooling **only** inside an explicit transaction. (3) Keep log writes in READ COMMITTED (T3) | app |
| G5b | LangGraph checkpointer cannot create or write its tables as the app role | `store/checkpoint.py:1-2` (`AsyncPostgresSaver.setup()`), `migrations/env.py:21` | App has no CREATE on `public`; tables created later get only SELECT for `orderfit_app` (verified: `insert=false update=false delete=false`); checkpoint tables have no RLS, yet hold tenant workflow state | HIGH | Run `setup()` as the migrator (an Alembic step), then `GRANT SELECT, INSERT, UPDATE, DELETE` on the checkpoint tables to `orderfit_app`. Also add `ALTER DEFAULT PRIVILEGES … GRANT INSERT, UPDATE` for them, or explicit grants. Consider RLS keyed on `thread_id → deal` | schema + app |
| G7 | `SupplierQuote` has no table | `domain.py:42-49` (`total_minor, currency, due_date, deposit_minor, bank_account_ref, sender_domain, sources`) | Only indirect homes: cash_event rows (supplier_payment), `payee_bank_account` fingerprint, `payee.known_domains`. Nothing stores the quote's sender domain or bank reference as received, which the fraud guard compares (F-01/F-02) | MEDIUM | Either store them as `extracted_field` rows on the quote document (`field='bank_account_ref'`, `'sender_domain'`), or add `supplier_quote` columns. Then document the mapping | app (preferred) |
| G8 | Trust level vs derived stats | `TrustLevel` enum and `Customer.trust_level` / `avg_days_late:int` (`domain.py:52-76`); `compute.TARGET_TOLERANCE_BY_TRUST` (`agent/nodes/compute.py:10-15`) | No column; `customer_payment_stats.avg_days_late` is numeric; the spec says "no trust ladder in the MVP" | MEDIUM | Decide: drop `trust_level` from `domain.py` (spec), or derive it from the view with documented thresholds | app |
| G9 | Business fields | `Business.cash_today_minor`, `known_bank_accounts: list[str]`, `known_domains` (`domain.py:63-66`) | No `business.cash`/`known_domains`; cash is the snapshot `deal.opening_cash_minor`; bank accounts are HMAC fingerprints in `payee_bank_account` | MEDIUM | Change `domain.Business`: drop `known_bank_accounts` (use payee accounts), move `known_domains` to payees or customers, and take opening cash per deal | app |
| G10 | Deal NOT NULL columns the domain never sets | `domain.Deal` (`domain.py:105-113`) has no `created_by`, `constraints_id`, `public_ref`, `start_date` | `deal.created_by NOT NULL` (0001:237), `constraints_id NOT NULL` (0001:226), `public_ref NOT NULL` (0001:216) | MEDIUM | Add these to the API create-deal path; `domain.Deal` gains `public_ref`, `constraints_id`, `created_by`, `start_date` | app |
| G11 | Approval shape differs | `domain.Approval` has `action_id` and `approver:str` (`domain.py:122-130`) | `approval` requires `action`, `idempotency_key`, `approver_id uuid`; send/commit also need `evaluation_id`, `option_key`, `action_plan_hash`, and (send) `message_id`, `message_sha256` (0001:449-473) | MEDIUM | Map `action_id → idempotency_key`; add `action`, `evaluation_id`, `option_key`, `action_plan_hash`, `message_id`, `message_sha256` to the domain model | app |
| G12 | Audit entry shape differs | `AuditEntry.event`, `details`, `at` (`domain.py:139-145`); no `outcome` or `tier` | `operation_log.action`, `payload`, `created_at` (trigger-assigned; caller value ignored), **`outcome NOT NULL` with no default** (0002:127) | MEDIUM | Add `outcome` (and `tier`) to `AuditEntry`; map event→action, details→payload; drop `at` | app |
| G13 | Engine result ↔ evaluation mapping undefined | `Result` (`engine/models.py:110-116`): `input_hash: str`, `recommended_option_id`, `OptionResult.delay_tolerance_days ≥ -1` with `survives_full_scan` / `survives_non_payment`; `Timeline.first_breach_day: int`; no verdict field; `CashEvent.event_id: str`, `kind: str` (free) | `input_hash bytea(32)`, `recommended_option_key`, NULL = "safe with no payment", `first_breach_date date`, `verdict` required, `event_id bigint`, kind CHECK | MEDIUM | Write one mapper in `agent/nodes/compute.py`: hex→bytea, `day→start_date+day`, `survives_non_payment → NULL tolerance`, a verdict rule (`recommended is None → no_feasible_plan`, `option == accept-as-is → feasible_as_offered`, else `plan_recommended`), `str(event_id)` | app |
| G14 | Deal state vocabularies | Spec 03 §4.1: 15 states. `domain.DealStatus`: 7. Frontend: `RECOMMENDED, COMMITTED, NEEDS_CONFIRMATION, AWAITING_REPLY, BLOCKED` (`frontend/app/deals/page.tsx:29`); `FEASIBLE, IN_NEGOTIATION, BLOCKED, ACCEPTED_OFFERED, INTERCEPTED` (`frontend/app/orders/page.tsx:41`); `BLOCKED, FEASIBLE, RECOMMENDED` (`deal-detail-client.tsx`) | `deal_status` has 8 (0004:20-28) | MEDIUM | All 7 `domain.py` values are representable, and `committed` is extra (not in domain or spec). **Missing from the spec:** DRAFT, READY, RECOMMENDED, DRAFTING, EXECUTING, EXECUTED, COMPENSATING, BLOCKED. **Frontend strings that are not workflow states** map to `evaluation.verdict` (FEASIBLE/ACCEPTED_OFFERED → `feasible_as_offered`, RECOMMENDED → `plan_recommended`, BLOCKED → `no_feasible_plan` or a blocking flag) or to flags (INTERCEPTED → `deal_flag.kind='injection'`). IN_NEGOTIATION = `awaiting_reply` or round > 0; NEEDS_CONFIRMATION = `awaiting_confirm`. Decide the state set, then add rows (0004 is data only) | design decision → schema data |
| G15 | Cash-flow UI statuses | `COMMITTED, CONFIRMED, PENDING_APPROVAL, BREACH_RISK, PROJECTED` (`frontend/app/cash-flow/page.tsx:29`) | `cash_event.certainty` (confirmed, expected); BREACH_RISK and PROJECTED are computed, not stored | LOW | The API derives these labels; nothing to store | app |
| G16 | Flag codes | Frontend and spec codes: `E-MISSING-ANCHOR, E-NO-FEASIBLE, E-DATA-CONFLICT, E-FRAGILE-BEST, E-SEVERE-FAIL, F-INJECTION, SEC-FRAUD, SEC-OVERRIDE`, … | `deal_flag.code` free text, `kind` CHECK (0001:402); `evaluation.verdict_code` free text | LOW | Representable. Optionally add a `flag_code` lookup table | — |
| G17 | Audit outcome / actor | Frontend `outcome: completed, blocked, confirmed` and `actor: engine, owner, agent, system` (`frontend/app/admin/logs/page.tsx:20-24`); audit page `actor` is free text like "Owner: Tariq Rahman" | Matches 0002:122,127, except the spec's `attempted`; free-text actor → `actor` + `actor_user_id` | LOW | — | app |
| G18 | Frontend fields with no home | Notifications (`components/notifications-dropdown.tsx:8-16`); payee `historicalDelayTolerance`, bank name in `verifiedBank`, riskRating `"Verified"` (`frontend/app/payees/page.tsx:19-47`); facility `interestMethod`, `rateBps` shown as APR (`financing/page.tsx:18-52`); admin engine `overdraftRatePct`, `defaultDailyBurn`, `resilienceFloorThreshold` (`admin/engine/page.tsx:21-26`); security settings `tierStepUpApproval`, `hashChainedAuditLog`, `rowLevelSecurity`, `sessionTimeoutMinutes` (`settings/page.tsx:69-74`); reply resolution `accept_hybrid, counter_floor, decline` (`deal-reply-client.tsx:30`); pasted-text inputs saved as text only (`deals/new/page.tsx:138-155`) | — | LOW | Notifications: add a table, or derive them from flags and log. Settings: `business.profile` / `app_user.preferences` jsonb. Pasted text: store as a `text/plain` document. The rest are UI-only or derived. **Have a home:** deal list fields (via `deal_pipeline`), cost lines → `cash_event` (`name→description`, `deferrable→is_deferrable`), extracted citations → `extracted_field.source_page/source_quote`, options/sensitivity → `evaluation_option` + `evaluation.output`, email → `negotiation_message`, plan hash/step-up → `approval`, users (`status`, `mfaEnforced`, `lastActive`), tenants (`status`, `synthetic`, `created`), risk constraints (all 12 fields → `owner_constraints`; % → bps), payee categories (4/4), financing kinds (4/4) | app |
| G19 | No idempotency, approval or error handling code | No routes (`api/routes/*.py` are bare `APIRouter`); the Idempotency-Key wrapper existed only as a comment in the deleted `web/lib/api.ts:1`; no SQLSTATE mapping | Triggers raise **23000** (append-only/immutable), **23514** (illegal transition, blocking flags, round, frozen inputs, and every CHECK; all share one SQLSTATE), **23503** (FK, including editing an approved body), **23505** (idempotency, second live eval, duplicate document), **42501** (privilege / RLS WITH CHECK), **22P02** (bad tenant GUC), **22008** (infinite dates), **22003** (bigint range), **54000 / 22P05** (NUL) | MEDIUM | API mapping: 23505 on `approval_business_id_idempotency_key_key` → replay the stored response; other 23505 → 409 `DUPLICATE_DOCUMENT` / `STALE_EVALUATION`; 23503 on `approval_message_id_message_sha256_fkey` → 409 `APPROVAL_INVALID`; 23514 from `deal_guard` → 409 (`STALE_INPUT_VERSION` / `NEEDS_INPUT`); other 23514 / 22xxx → 400 `VALIDATION_FAILED`; 23000 → 409; 42501 → 404 (spec: never 403 across tenants). Because `deal_guard` uses 23514 for four different conditions, give each its own SQLSTATE (e.g. `OF001..OF004`) or a `CONSTRAINT` name so the API need not parse message text | schema + app |

## 5. Edge cases the schema does NOT stop (the API must)

1. Approver authority. The DB accepts approvals from a `commercial_lead` (T2), a **suspended** user, and without `step_up_verified_at` (o5, o6, o9).
2. Approval coherence. The DB accepts:
   - an approval against a **superseded** evaluation (o13b);
   - an evaluation from another deal (o12);
   - a message from another deal (o8);
   - another tenant's evaluation or message (b3, b4). This one should move into the schema (G20).
3. Sending. An outbound message can be set `sent` with no approval at all (o10). `body_sha256` can be overwritten (o7) unless G24 is applied.
4. Workflow entry. Deals can be **inserted** in any status or round (e2, e3, i5) unless G22 is applied.
5. Frozen inputs. Payment terms, delivery date, customer, currency and target scenario stay editable after compute (h ×7) unless G21 is applied.
6. Optimistic locking. The trigger bumps `version` but never compares it. The API must use `UPDATE … WHERE id = :id AND version = :expected` and treat 0 rows as 409 (hC).
7. Dates.
   - delivery before start (k1)
   - `infinity` (k7)
   - year 1 / 9999 (k5, k6, k8): events outside 0..540 days are silently dropped from the engine view, so the API must emit W-BASELINE-COVERAGE
   - due-date maths (Net N from delivery or invoice, month-end) is done by the app; the schema stores only `payment_days` and `payment_basis`
8. Same-day ordering. `engine_input_events` has no ORDER BY. The engine (or the query) must order by `day`, then outflows before inflows (l1).
9. Currency consistency. Deal vs business currency (j7). Cash events and invoices carry no currency.
10. Extracted values. Empty string and JSON `null` are accepted as values (u12, u13). A field may cite a document of another deal (u14).
11. Documents. Duplicate content across deals of the same business is allowed (u7). The repo requires per-business dedupe, so the API must check. MIME type is whatever the caller claims, so the API must sniff the bytes. Size checking is the API's job before upload; the DB only checks the declared number.
12. Text size. Message bodies have no cap (10.5 MB accepted, x2). NUL bytes are rejected with 54000 / 22P05 (x3, x4). Text extracted from PDFs must be stripped of `\x00` before insert.
13. Tenant GUC. The API alone decides `app.business_id`, and any session can set `app.is_platform_admin=on` (v9, v10). Never build SQL from request input, and never expose a raw SQL path.
14. Users. The API must never return `app_user` rows except through `membership`. Until G23 is applied, the app and readonly roles can read every user's `password_hash` (v11, w6) and set `is_platform_admin` (v12).
15. Negotiation. `max_negotiation_rounds` in `owner_constraints` is not enforced against `deal.negotiation_round` (the hard cap is 3 in the CHECK). `evaluation.round` is not tied to `deal.negotiation_round` (m8).
16. Isolation level. Write `operation_log` under READ COMMITTED, or retry on 23505 `operation_log_scope_seq_key` (T3).
17. Audit verification. `verify_operation_log()` cannot detect deletion of the newest rows (rT2). Export the head hash periodically. For another tenant's id it returns `ok=true, rows_checked=0` (r4); the API should treat `rows_checked=0` as "nothing verified".

## 6. Not verified, and what I would need

| Item | Why | Needed |
|---|---|---|
| `tests/test_schema.sql` (91 assertions) | File not in the repository | Commit the file (the doc references `tests/test_schema.sql`) |
| `tests/test_concurrency.sh` | File not in the repository | Commit it. An equivalent pgbench run passed (T1, T2) |
| Rina: $9,000 loan costs $370, survives 26 days late | Engine financing maths, not schema behaviour; the backend engine is still stubs | The production engine, or permission to run `docs/architecture/orderfit/fixtures/reference_engine.py` against stored rows |
| Neon specifics: `CREATE ROLE` inside the migration (0003:57-61), the owner role's RLS bypass, `SET LOCAL` through the pooled endpoint | No access to Neon allowed (rule: no real DBs) | A throwaway Neon branch and its direct and pooled URLs (provided out of band, not in chat) |
| PostgreSQL 17 (compose and CI) | Tested on 16 only | Repeat on `postgres:17` (expected to behave the same; `security_invoker` needs 15+) |

## 7. Cleanup

- `docker rm -f of-verify-pg` removed the container, which held every throwaway database: `of_verify`, `of_verify_alembic`, `of_rerun`, `of_scale`. `of_tamper` had already been dropped with `DROP DATABASE`. `docker ps -a --filter name=of-verify` now lists 0 containers.
- I removed the container's anonymous data volume `aa197473…`, which was created 2026-10-15T05:53:07Z when the container started. The other dangling volumes on this machine predate this session and were left alone.
- `verify_owner`, the temporary role used for probe d4, was created inside a rolled-back transaction: `verify_owner roles left: 0`.
- No `.pyc` files were written under `backend/migrations` (`PYTHONDONTWRITEBYTECODE=1`). Scratch scripts are in the session scratchpad only, outside the repository.
- **No tracked file was modified.** The only new file is this report. Every other entry below was already present before the review started (the user's own uncommitted work):

```
$ git status --short
 M .github/workflows/tests.yml
 M README.md
 M docker-compose.yml
 M docs/team-assessment.md
 M frontend/.gitignore
 M frontend/app/api/health/route.ts
 M frontend/app/deals/new/validate/page.tsx
 M frontend/components/layout/admin-sidebar.tsx
 M frontend/components/layout/connection-indicator.tsx
 M frontend/next.config.ts
 M frontend/package.json
D  web/... (17 files, staged deletion, pre-existing)
?? backend/migrations/sql/
?? backend/migrations/versions/0001_core_schema.py
?? docs/database-verification-report.md      <- this report (the only file written)
?? docs/database/
?? frontend/.dockerignore
?? frontend/.env.example
?? frontend/Dockerfile
?? frontend/lib/api.ts
```
