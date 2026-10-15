-- Reverses 0001-0004. Roles (orderfit_app, orderfit_admin, orderfit_readonly) are cluster-level and
-- are left in place. The TEMPORARY privilege revoked in 0003 is given back to PUBLIC.
DROP VIEW IF EXISTS approval_staleness, deal_pipeline, customer_payment_stats, engine_input_coverage, engine_input_events;

DROP TABLE IF EXISTS
  idempotency_key, notification, whatif_run, execution_action, approval, negotiation_message, deal_flag,
  evaluation_option, evaluation, cash_event, extracted_field, document, operation_log, deal,
  financing_offer, owner_constraints, payee_bank_account, payee, customer_invoice, customer,
  membership, app_user, business, cash_event_kind, deal_transition, deal_status, app_role, currency
CASCADE;

DROP FUNCTION IF EXISTS
  verify_operation_log(uuid), operation_log_chain(), membership_guard(), execution_action_guard(),
  approval_guard(), message_status_guard(), message_hash(), deal_guard(), deal_defaults(),
  evaluation_insert_guard(), evaluation_guard(), app_is_restricted(), forbid_change(), touch_updated_at(),
  auth_lookup(text), user_businesses(uuid), app_business_id(), app_user_id();

DROP DOMAIN IF EXISTS biz_date;
DROP SCHEMA IF EXISTS langgraph CASCADE;

DO $$
BEGIN
  EXECUTE format('GRANT TEMPORARY ON DATABASE %I TO PUBLIC', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'could not restore TEMPORARY on database %', current_database();
END $$;
