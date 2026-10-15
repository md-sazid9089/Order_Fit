-- P1: extend existing identity/financial/evidence objects, never replace 0001.
ALTER TABLE business ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0),
 ADD COLUMN financial_revision bigint NOT NULL DEFAULT 1 CHECK(financial_revision>0),
 ADD COLUMN baseline_settings jsonb, ADD COLUMN default_constraints_id uuid;
ALTER TABLE business ADD FOREIGN KEY(id,default_constraints_id) REFERENCES owner_constraints(business_id,id);
ALTER TABLE app_user ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
GRANT SELECT(version) ON app_user TO orderfit_app,orderfit_readonly;
ALTER TABLE membership ADD COLUMN version integer NOT NULL DEFAULT 1,
 ADD COLUMN revoked_at timestamptz;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['customer','customer_invoice','payee','payee_bank_account','financing_offer','cash_event','document','extracted_field'] LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0)',t);
 END LOOP;
END $$;
ALTER TABLE cash_event ADD COLUMN voided_at timestamptz, ADD COLUMN supersedes_id bigint,
 ADD UNIQUE(business_id,id),
 ADD FOREIGN KEY(business_id,supersedes_id) REFERENCES cash_event(business_id,id);
ALTER TABLE document ADD COLUMN source_role text CHECK(source_role IN
 ('customer_order','customer_sales_quote','supplier_cost_quote','baseline','financing','owner_constraints','reply','other'));
-- Historical ambiguous quotes remain NULL, not falsely backfilled as sales/costs.
ALTER TABLE owner_constraints DROP CONSTRAINT owner_constraints_priorities_check;
ALTER TABLE owner_constraints ADD CHECK(priorities <@ ARRAY['profit','robustness','independence_any','independence_customer','simplicity','low_financing_cost'] AND cardinality(priorities) BETWEEN 1 AND 6);
INSERT INTO deal_transition VALUES('computing','awaiting_confirm');
ALTER TABLE deal ADD COLUMN input_version bigint NOT NULL DEFAULT 1 CHECK(input_version>0);
ALTER TABLE evaluation ADD COLUMN snapshot_id uuid, ADD COLUMN input_version bigint,
 ADD COLUMN financial_revision bigint, ADD COLUMN tolerance_status text
 CHECK(tolerance_status IN ('legacy_unknown','fails_on_time','first_failure','capped_scan','proved_nonpayment_survival'));
-- The immutable guard must not be disabled to rewrite old financial history.
-- NULL on legacy rows means unclassified; consumers must label legacy_unknown.
ALTER TABLE evaluation_option ADD COLUMN tolerance_status text
 CHECK(tolerance_status IN ('legacy_unknown','fails_on_time','first_failure','capped_scan','proved_nonpayment_survival')),
 ADD COLUMN tolerance_scan_cap integer CHECK(tolerance_scan_cap BETWEEN 1 AND 540);
ALTER TABLE whatif_run ADD COLUMN snapshot_id uuid, ADD COLUMN input_version bigint, ADD COLUMN financial_revision bigint;
ALTER TABLE idempotency_key ADD COLUMN key_version integer NOT NULL DEFAULT 1;
REVOKE CREATE ON SCHEMA langgraph FROM orderfit_app;

CREATE TABLE auth_session(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user(id),
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 csrf_digest bytea NOT NULL CHECK(octet_length(csrf_digest)=32),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_active_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '8 hours', revoked_at timestamptz,
 UNIQUE(user_id,id), CHECK(expires_at>created_at)
);
CREATE INDEX auth_session_user ON auth_session(user_id) WHERE revoked_at IS NULL;
CREATE TABLE auth_request(
 scope bytea NOT NULL CHECK(octet_length(scope)=32), key text NOT NULL CHECK(length(key) BETWEEN 1 AND 200),
 request_hash bytea NOT NULL CHECK(octet_length(request_hash)=32), result jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(scope,key)
);
CREATE TABLE auth_rate_limit(key bytea PRIMARY KEY, count integer NOT NULL, started_at timestamptz NOT NULL);
CREATE TABLE security_event(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES app_user(id),
 code text NOT NULL CHECK(length(code)<=100), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Private global auth data: only the named bounded helpers below can reach it.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['auth_session','auth_request','auth_rate_limit','security_event'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY auth_owner ON %I TO %I USING(true) WITH CHECK(true)',t,current_user);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,orderfit_app,orderfit_readonly',t);
 END LOOP;
END $$;

CREATE TABLE input_snapshot(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, deal_id uuid NOT NULL,
 input_version bigint NOT NULL CHECK(input_version>0), financial_revision bigint NOT NULL CHECK(financial_revision>0),
 schema_version text NOT NULL CHECK(schema_version='confirmed-input.v1'), payload jsonb NOT NULL,
 canonical_payload bytea NOT NULL, snapshot_hash bytea NOT NULL CHECK(octet_length(snapshot_hash)=32),
 confirmed_by uuid NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(business_id,deal_id,id), UNIQUE(business_id,deal_id,input_version,financial_revision,snapshot_hash),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(confirmed_by,business_id) REFERENCES membership(user_id,business_id),
 CHECK(sha256(canonical_payload)=snapshot_hash), CHECK(convert_from(canonical_payload,'UTF8')::jsonb=payload)
);
ALTER TABLE evaluation ADD FOREIGN KEY(business_id,deal_id,snapshot_id) REFERENCES input_snapshot(business_id,deal_id,id);
ALTER TABLE whatif_run ADD FOREIGN KEY(business_id,deal_id,snapshot_id) REFERENCES input_snapshot(business_id,deal_id,id);
CREATE TABLE step_up_grant(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id),
 user_id uuid NOT NULL, session_id uuid NOT NULL, bundle_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('send_message','commit_plan','compensate')),
 bundle_hash bytea NOT NULL CHECK(octet_length(bundle_hash)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 consumed_at timestamptz, FOREIGN KEY(user_id,session_id) REFERENCES auth_session(user_id,id),
 FOREIGN KEY(user_id,business_id) REFERENCES membership(user_id,business_id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '5 minutes')
);
CREATE TABLE operation(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id), deal_id uuid,
 actor_user_id uuid NOT NULL, session_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('extract','evaluate','explain','draft','whatif','reply','execute','csv_preview')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 subphase text NOT NULL DEFAULT 'queued', version integer NOT NULL DEFAULT 1,
 request_hash bytea NOT NULL CHECK(octet_length(request_hash)=32), input_version bigint,
 financial_revision bigint NOT NULL, snapshot_id uuid, source_document_id uuid,
 config_version text NOT NULL, result jsonb, cancellation_requested boolean NOT NULL DEFAULT false,
 queued_at timestamptz NOT NULL DEFAULT clock_timestamp(), started_at timestamptz, finished_at timestamptz,
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 3),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(), lease_owner text,
 lease_token uuid, lease_expires_at timestamptz,
 UNIQUE(business_id,id), FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(actor_user_id,business_id) REFERENCES membership(user_id,business_id),
 FOREIGN KEY(actor_user_id,session_id) REFERENCES auth_session(user_id,id),
 FOREIGN KEY(business_id,deal_id,snapshot_id) REFERENCES input_snapshot(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,source_document_id) REFERENCES document(business_id,deal_id,id),
 CHECK((deal_id IS NULL)=(input_version IS NULL)),
 CHECK(source_document_id IS NULL OR deal_id IS NOT NULL),
 CHECK((status='running')=(lease_token IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE INDEX operation_claim ON operation(available_at,queued_at,id) WHERE status IN ('queued','running');
CREATE INDEX operation_tenant ON operation(business_id,queued_at,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['input_snapshot','step_up_grant','operation'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(business_id=(SELECT app_business_id())) WITH CHECK(business_id=(SELECT app_business_id()))',t);
  EXECUTE format('GRANT SELECT ON %I TO orderfit_app',t);
 END LOOP;
END $$;
GRANT INSERT ON input_snapshot,operation TO orderfit_app;
GRANT UPDATE(cancellation_requested,version) ON operation TO orderfit_app;
CREATE TRIGGER snapshot_immutable BEFORE UPDATE OR DELETE ON input_snapshot FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER snapshot_no_truncate BEFORE TRUNCATE ON input_snapshot EXECUTE FUNCTION forbid_change();
CREATE TRIGGER operation_no_delete BEFORE DELETE ON operation FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER operation_no_truncate BEFORE TRUNCATE ON operation EXECUTE FUNCTION forbid_change();
CREATE TRIGGER security_event_immutable BEFORE UPDATE OR DELETE ON security_event FOR EACH ROW EXECUTE FUNCTION forbid_change();
-- Narrow queue helpers need owner access, never a privileged worker connection.
DO $$ BEGIN
 EXECUTE format('CREATE POLICY queue_owner ON operation TO %I USING(true) WITH CHECK(true)',current_user);
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_worker') THEN CREATE ROLE orderfit_worker NOLOGIN; END IF;
END $$;
GRANT orderfit_app TO orderfit_worker;

CREATE FUNCTION foundation_business_version() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 NEW.version:=OLD.version+1;
 IF pg_trigger_depth()=1 THEN NEW.financial_revision:=OLD.financial_revision; END IF;
 IF (NEW.currency,NEW.timezone,NEW.baseline_settings,NEW.default_constraints_id) IS DISTINCT FROM
    (OLD.currency,OLD.timezone,OLD.baseline_settings,OLD.default_constraints_id) THEN
  IF NEW.currency<>OLD.currency AND (EXISTS(SELECT FROM public.deal WHERE business_id=OLD.id)
   OR EXISTS(SELECT FROM public.cash_event WHERE business_id=OLD.id)
   OR EXISTS(SELECT FROM public.financing_offer WHERE business_id=OLD.id)
   OR EXISTS(SELECT FROM public.customer_invoice WHERE business_id=OLD.id)) THEN
   RAISE EXCEPTION 'currency locked' USING ERRCODE='OF003'; END IF;
  NEW.financial_revision:=OLD.financial_revision+1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER business_revision BEFORE UPDATE ON business FOR EACH ROW EXECUTE FUNCTION foundation_business_version();
CREATE FUNCTION foundation_deal_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','version','input_version','negotiation_round','updated_at','closed_at','po_number']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','version','input_version','negotiation_round','updated_at','closed_at','po_number']) THEN
  IF OLD.status NOT IN ('ingesting','awaiting_confirm','failed') THEN
   RAISE EXCEPTION 'frozen inputs' USING ERRCODE='OF003'; END IF;
  NEW.input_version:=OLD.input_version+1;
  UPDATE public.evaluation SET superseded_at=clock_timestamp() WHERE deal_id=OLD.id AND superseded_at IS NULL;
 ELSIF pg_trigger_depth()=1 THEN NEW.input_version:=OLD.input_version;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER deal_revision BEFORE UPDATE ON deal FOR EACH ROW EXECUTE FUNCTION foundation_deal_revision();
CREATE FUNCTION foundation_child_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b uuid; d uuid; rowdata jsonb; BEGIN
 rowdata:=to_jsonb(NEW); b:=(rowdata->>'business_id')::uuid;
 -- Reject moves, not just cross-tenant FK failures. Revisions cannot be bypassed by reparenting.
 IF TG_OP='UPDATE' AND ((rowdata->>'business_id') IS DISTINCT FROM (to_jsonb(OLD)->>'business_id')
  OR (rowdata->>'deal_id') IS DISTINCT FROM (to_jsonb(OLD)->>'deal_id')) THEN
  RAISE EXCEPTION 'immutable scope' USING ERRCODE='OF003'; END IF;
 UPDATE public.business SET financial_revision=financial_revision+1 WHERE id=b;
 d:=(rowdata->>'deal_id')::uuid;
 IF d IS NOT NULL THEN
  UPDATE public.deal SET input_version=input_version+1 WHERE business_id=b AND id=d;
  UPDATE public.evaluation SET superseded_at=clock_timestamp() WHERE business_id=b AND deal_id=d AND superseded_at IS NULL;
 END IF;
 IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['customer','customer_invoice','payee','payee_bank_account','financing_offer','cash_event','document','extracted_field'] LOOP
  EXECUTE format('CREATE TRIGGER foundation_revision BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION foundation_child_revision()',t);
 END LOOP;
END $$;
CREATE FUNCTION foundation_constraints_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 UPDATE public.business SET financial_revision=financial_revision+1 WHERE id=NEW.business_id;
 RETURN NEW;
END $$;
CREATE TRIGGER constraints_revision AFTER INSERT ON owner_constraints FOR EACH ROW EXECUTE FUNCTION foundation_constraints_revision();
CREATE FUNCTION foundation_membership_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 PERFORM 1 FROM public.business WHERE id=OLD.business_id FOR UPDATE;
 IF OLD.role='owner' AND OLD.revoked_at IS NULL AND (NEW.role<>'owner' OR NEW.revoked_at IS NOT NULL)
 AND NOT EXISTS(SELECT FROM public.membership WHERE business_id=OLD.business_id AND user_id<>OLD.user_id AND role='owner' AND revoked_at IS NULL) THEN
  RAISE EXCEPTION 'last active owner' USING ERRCODE='OF009'; END IF;
 NEW.version:=OLD.version+1; RETURN NEW;
END $$;
CREATE TRIGGER membership_last_owner BEFORE UPDATE ON membership FOR EACH ROW EXECUTE FUNCTION foundation_membership_guard();
CREATE FUNCTION foundation_snapshot_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE revision bigint; input_ bigint; state_ text; BEGIN
 SELECT financial_revision INTO revision FROM public.business WHERE id=NEW.business_id FOR UPDATE;
 SELECT input_version,status INTO input_,state_ FROM public.deal WHERE business_id=NEW.business_id AND id=NEW.deal_id FOR UPDATE;
 IF NEW.financial_revision IS DISTINCT FROM revision OR NEW.input_version IS DISTINCT FROM input_
  OR state_ IS DISTINCT FROM 'awaiting_confirm' THEN RAISE EXCEPTION 'stale snapshot' USING ERRCODE='OF003'; END IF;
 IF public.app_is_restricted() AND (NEW.confirmed_by IS DISTINCT FROM public.app_user_id()
  OR NOT EXISTS(SELECT FROM public.membership WHERE business_id=NEW.business_id AND user_id=NEW.confirmed_by
   AND revoked_at IS NULL AND role IN ('commercial_lead','risk_officer','owner'))) THEN
  RAISE EXCEPTION 'invalid confirmation actor' USING ERRCODE='42501'; END IF;
 IF NEW.payload->>'business_id' IS DISTINCT FROM NEW.business_id::text
  OR NEW.payload->>'deal_id' IS DISTINCT FROM NEW.deal_id::text
  OR NEW.payload->>'input_version' IS DISTINCT FROM NEW.input_version::text
  OR NEW.payload->>'financial_revision' IS DISTINCT FROM NEW.financial_revision::text
  OR NEW.payload->>'schema_version' IS DISTINCT FROM NEW.schema_version THEN
  RAISE EXCEPTION 'snapshot metadata mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_entry BEFORE INSERT ON input_snapshot FOR EACH ROW EXECUTE FUNCTION foundation_snapshot_guard();
-- Self-only global updates, not another member's global credential/status.
DROP POLICY app_user_update ON app_user;
CREATE POLICY app_user_update ON app_user FOR UPDATE USING(id=app_user_id()) WITH CHECK(id=app_user_id());
REVOKE UPDATE(password_hash,auth_subject,mfa_enforced,status) ON app_user FROM orderfit_app;

CREATE FUNCTION session_resolve(p_digest bytea) RETURNS TABLE(session_id uuid,user_id uuid,csrf_digest bytea,expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_session s SET last_active_at=clock_timestamp()
 FROM public.app_user u WHERE s.token_digest=p_digest AND octet_length(p_digest)=32 AND s.user_id=u.id
 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND u.status='active' AND NOT u.mfa_enforced
 RETURNING s.id,s.user_id,s.csrf_digest,s.expires_at
$$;
CREATE FUNCTION session_issue(p_email text,p_expected_hash text,p_digest bytea,p_csrf bytea) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u public.app_user; sid uuid; BEGIN
 SELECT * INTO u FROM public.app_user WHERE email=lower(btrim(p_email)) FOR UPDATE;
 IF NOT FOUND OR u.status<>'active' OR u.mfa_enforced OR u.password_hash IS DISTINCT FROM p_expected_hash THEN
  RAISE EXCEPTION 'invalid authentication' USING ERRCODE='42501'; END IF;
 INSERT INTO public.auth_session(user_id,token_digest,csrf_digest) VALUES(u.id,p_digest,p_csrf) RETURNING id INTO sid;
 RETURN sid;
END $$;
CREATE FUNCTION session_revoke(p_digest bytea) RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_session SET revoked_at=coalesce(revoked_at,clock_timestamp()),version=version+1 WHERE token_digest=p_digest
$$;
CREATE FUNCTION session_password(p_digest bytea,p_expected text,p_new text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE uid uuid; BEGIN
 SELECT s.user_id INTO uid FROM public.auth_session s WHERE token_digest=p_digest AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF uid IS NULL OR p_new NOT LIKE '$argon2id$%' THEN RETURN false; END IF;
 UPDATE public.app_user SET password_hash=p_new,version=version+1 WHERE id=uid AND password_hash=p_expected AND status='active' AND NOT mfa_enforced;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.auth_session SET revoked_at=clock_timestamp(),version=version+1 WHERE user_id=uid AND revoked_at IS NULL;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION user_businesses(p_user uuid) RETURNS TABLE(business_id uuid,business_name text,role text,tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT b.id,b.name,m.role,r.tier FROM public.membership m JOIN public.business b ON b.id=m.business_id
 JOIN public.app_role r ON r.code=m.role WHERE m.user_id=p_user AND p_user=public.app_user_id()
 AND m.revoked_at IS NULL AND b.status='active' ORDER BY b.id
$$;
CREATE FUNCTION owner_provision(p_email text,p_name text,p_hash text,p_business text,p_currency text,p_timezone text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE uid uuid:=gen_random_uuid(); bid uuid:=gen_random_uuid(); cid uuid; oldb text; oldu text; BEGIN
 IF length(p_email)>254 OR length(p_name)>2000 OR length(p_business)>2000 OR p_hash NOT LIKE '$argon2id$%' THEN
  RAISE EXCEPTION 'invalid provisioning' USING ERRCODE='23514'; END IF;
 oldb:=current_setting('app.business_id',true); oldu:=current_setting('app.user_id',true);
 PERFORM set_config('app.business_id',bid::text,true),set_config('app.user_id',uid::text,true);
 INSERT INTO public.app_user(id,email,full_name,password_hash,status,mfa_enforced,preferences)
 VALUES(uid,lower(btrim(p_email)),p_name,p_hash,'active',false,jsonb_build_object('timezone',p_timezone,'language','en','in_app_notifications',true));
 INSERT INTO public.business(id,name,currency,timezone) VALUES(bid,p_business,p_currency,p_timezone);
 INSERT INTO public.membership(user_id,business_id,role) VALUES(uid,bid,'owner');
 INSERT INTO public.owner_constraints(business_id,version,safety_reserve_minor,min_delay_tolerance_days,created_by,strategy_space)
 VALUES(bid,1,0,0,uid,'{"deposit_pcts":[0],"extensions":[{"days":0,"surcharge_bps":0}],"offer_ids":[],"stages":[1]}') RETURNING id INTO cid;
 UPDATE public.business SET default_constraints_id=cid WHERE id=bid;
 INSERT INTO public.operation_log(business_id,actor,actor_user_id,action,outcome) VALUES(bid,'system',uid,'owner_provision','completed');
 PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true);
 RETURN uid;
END $$;
CREATE FUNCTION auth_request_reserve(p_scope bytea,p_key text,p_hash bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.auth_request; BEGIN
 DELETE FROM public.auth_request WHERE scope=p_scope AND key=p_key AND created_at<clock_timestamp()-interval '24 hours';
 INSERT INTO public.auth_request(scope,key,request_hash) VALUES(p_scope,p_key,p_hash) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.auth_request WHERE scope=p_scope AND key=p_key FOR UPDATE;
 IF r.request_hash<>p_hash THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='OF003'; END IF;
 RETURN r.result;
END $$;
CREATE FUNCTION auth_request_complete(p_scope bytea,p_key text,p_hash bytea,p_result jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_request SET result=p_result WHERE scope=p_scope AND key=p_key AND request_hash=p_hash AND result IS NULL
$$;
CREATE FUNCTION auth_rate_consume(p_key bytea) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 INSERT INTO public.auth_rate_limit AS r(key,count,started_at) VALUES(p_key,1,clock_timestamp())
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN r.started_at<clock_timestamp()-interval '15 minutes' THEN 1 ELSE r.count+1 END,
 started_at=CASE WHEN r.started_at<clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE r.started_at END
 RETURNING count<=15
$$;
CREATE FUNCTION security_record(p_digest bytea,p_code text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 INSERT INTO public.security_event(user_id,code) VALUES((SELECT user_id FROM public.auth_session WHERE token_digest=p_digest),left(p_code,100))
$$;
-- Helpers are not public and never accept SQL, roles, admin flags or arbitrary actor IDs.
REVOKE ALL ON FUNCTION session_resolve(bytea),session_issue(text,text,bytea,bytea),session_revoke(bytea),session_password(bytea,text,text),owner_provision(text,text,text,text,text,text),auth_request_reserve(bytea,text,bytea),auth_request_complete(bytea,text,bytea,jsonb),auth_rate_consume(bytea),security_record(bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION session_resolve(bytea),session_issue(text,text,bytea,bytea),session_revoke(bytea),session_password(bytea,text,text),owner_provision(text,text,text,text,text,text),auth_request_reserve(bytea,text,bytea),auth_request_complete(bytea,text,bytea,jsonb),auth_rate_consume(bytea),security_record(bytea,text) TO orderfit_app;
CREATE FUNCTION session_csrf(p_digest bytea,p_csrf bytea) RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_session SET csrf_digest=p_csrf WHERE token_digest=p_digest AND revoked_at IS NULL AND expires_at>clock_timestamp()
$$;
REVOKE ALL ON FUNCTION session_csrf(bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION session_csrf(bytea,bytea) TO orderfit_app;

CREATE FUNCTION operation_insert_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF public.app_is_restricted() AND (NEW.actor_user_id IS DISTINCT FROM public.app_user_id()
  OR NEW.session_id IS DISTINCT FROM nullif(current_setting('app.session_id',true),'')::uuid
  OR NEW.status<>'queued' OR NEW.attempt<>0 OR NEW.lease_token IS NOT NULL
  OR NEW.lease_owner IS NOT NULL OR NEW.lease_expires_at IS NOT NULL
  OR NEW.result IS NOT NULL OR NEW.version<>1 OR NEW.cancellation_requested
  OR NEW.subphase<>'queued' OR NEW.started_at IS NOT NULL OR NEW.finished_at IS NOT NULL) THEN
  RAISE EXCEPTION 'invalid operation admission' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER operation_entry BEFORE INSERT ON operation FOR EACH ROW EXECUTE FUNCTION operation_insert_guard();
CREATE FUNCTION operation_claim(p_worker text) RETURNS TABLE(id uuid,business_id uuid,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job public.operation; candidate public.operation; now_ timestamptz:=clock_timestamp(); valid boolean;
 oldb text:=current_setting('app.business_id',true); oldu text:=current_setting('app.user_id',true); BEGIN
 IF length(p_worker) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid worker' USING ERRCODE='23514'; END IF;
 FOR candidate IN SELECT o.* FROM public.operation o WHERE
  (o.status='queued' AND o.available_at<=now_) OR (o.status='running' AND o.lease_expires_at<=now_)
  ORDER BY o.available_at,o.queued_at,o.id LIMIT 20 LOOP
  PERFORM set_config('app.business_id',candidate.business_id::text,true),set_config('app.user_id',candidate.actor_user_id::text,true);
  PERFORM 1 FROM public.business b WHERE b.id=candidate.business_id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF candidate.deal_id IS NOT NULL THEN PERFORM 1 FROM public.deal d WHERE d.id=candidate.deal_id FOR UPDATE; END IF;
  SELECT * INTO job FROM public.operation o WHERE o.id=candidate.id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR NOT ((job.status='queued' AND job.available_at<=now_) OR (job.status='running' AND job.lease_expires_at<=now_)) THEN CONTINUE; END IF;
  SELECT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
   JOIN public.business b ON b.id=m.business_id JOIN public.auth_session s ON s.user_id=u.id
   WHERE m.business_id=job.business_id AND m.user_id=job.actor_user_id AND m.revoked_at IS NULL
   AND m.role IN ('commercial_lead','risk_officer','owner') AND u.status='active' AND NOT u.mfa_enforced
   AND b.status='active' AND s.id=job.session_id AND s.revoked_at IS NULL AND s.expires_at>now_
   AND s.last_active_at>now_-interval '30 minutes') INTO valid;
  IF NOT valid OR job.attempt>=3 OR job.cancellation_requested THEN
   UPDATE public.operation o SET status=CASE WHEN job.cancellation_requested THEN 'cancelled' ELSE 'failed' END,
    subphase=CASE WHEN job.cancellation_requested THEN 'cancelled' WHEN NOT valid THEN 'authorization_revoked' ELSE 'attempts_exhausted' END,
    result=CASE WHEN job.cancellation_requested THEN NULL ELSE jsonb_build_object('kind','failed','error',jsonb_build_object(
     'code',CASE WHEN NOT valid THEN 'AUTHORIZATION_REVOKED' ELSE 'ATTEMPTS_EXHAUSTED' END,
     'message','The operation could not be completed.','request_id',gen_random_uuid(),'details','{}'::jsonb,'retryable',false)) END,
    finished_at=now_,lease_token=NULL,lease_expires_at=NULL,version=o.version+1
    WHERE o.id=job.id;
   IF job.kind='evaluate' THEN UPDATE public.deal d SET status=CASE WHEN job.cancellation_requested THEN 'awaiting_confirm' ELSE 'failed' END WHERE d.id=job.deal_id AND d.status='computing'; END IF;
   INSERT INTO public.operation_log(business_id,deal_id,actor,actor_user_id,action,outcome,payload)
    VALUES(job.business_id,job.deal_id,'system',job.actor_user_id,'operation_terminal','completed',jsonb_build_object('operation_id',job.id));
   CONTINUE;
  END IF;
  RETURN QUERY UPDATE public.operation o SET status='running',subphase='claimed',
   started_at=coalesce(o.started_at,now_),attempt=o.attempt+1,lease_owner=p_worker,
   lease_token=gen_random_uuid(),lease_expires_at=now_+interval '60 seconds',version=o.version+1
   WHERE o.id=job.id RETURNING o.id,o.business_id,o.lease_token;
  INSERT INTO public.operation_log(business_id,deal_id,actor,actor_user_id,action,outcome,payload)
   VALUES(job.business_id,job.deal_id,'system',job.actor_user_id,'operation_claim','completed',jsonb_build_object('operation_id',job.id,'attempt',job.attempt+1));
  PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true);
  RETURN;
 END LOOP;
 PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true);
END $$;
CREATE FUNCTION operation_context(p_id uuid,p_token uuid) RETURNS TABLE(business_id uuid,user_id uuid,session_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT o.business_id,o.actor_user_id,o.session_id FROM public.operation o
 JOIN public.membership m ON m.business_id=o.business_id AND m.user_id=o.actor_user_id
 JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
 JOIN public.app_user u ON u.id=o.actor_user_id JOIN public.business b ON b.id=o.business_id
 WHERE o.id=p_id AND o.lease_token=p_token AND o.status='running' AND o.lease_expires_at>clock_timestamp()
 AND NOT o.cancellation_requested AND m.revoked_at IS NULL AND m.role IN ('commercial_lead','risk_officer','owner')
 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND u.status='active' AND NOT u.mfa_enforced AND b.status='active'
$$;
CREATE FUNCTION operation_heartbeat(p_id uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.operation_context(p_id,p_token)) THEN RETURN false; END IF;
 UPDATE public.operation SET lease_expires_at=clock_timestamp()+interval '60 seconds',version=version+1
 WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_expires_at>clock_timestamp();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION operation_claim(text),operation_context(uuid,uuid),operation_heartbeat(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operation_claim(text),operation_context(uuid,uuid),operation_heartbeat(uuid,uuid) TO orderfit_worker;
-- Tenant-scoped finalization is fenced even under direct runtime-role SQL.
CREATE FUNCTION operation_finish(p_id uuid,p_token uuid,p_result jsonb,p_retry boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job public.operation; b public.business; d public.deal; oldb text; oldu text; BEGIN
 SELECT * INTO job FROM public.operation WHERE id=p_id;
 IF NOT FOUND THEN RETURN false; END IF;
 -- Global owner lookup only establishes scope; actual locks use business/deal/job order.
 oldb:=current_setting('app.business_id',true); oldu:=current_setting('app.user_id',true);
 PERFORM set_config('app.business_id',job.business_id::text,true),set_config('app.user_id',job.actor_user_id::text,true);
 SELECT * INTO b FROM public.business WHERE id=job.business_id FOR UPDATE;
 IF job.deal_id IS NOT NULL THEN SELECT * INTO d FROM public.deal WHERE id=job.deal_id FOR UPDATE; END IF;
 SELECT * INTO job FROM public.operation WHERE id=p_id FOR UPDATE;
 IF job.lease_token IS DISTINCT FROM p_token OR job.status<>'running' OR job.lease_expires_at<=clock_timestamp() THEN
  PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true); RETURN false;
 END IF;
 IF job.cancellation_requested THEN
  UPDATE public.operation SET status='cancelled',subphase='cancelled',lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF NOT EXISTS(SELECT FROM public.operation_context(p_id,p_token)) THEN
  UPDATE public.operation SET status='failed',subphase='authorization_revoked',result=jsonb_build_object('kind','failed','error',jsonb_build_object('code','AUTHORIZATION_REVOKED','message','The operation could not be completed.','request_id',gen_random_uuid(),'details','{}'::jsonb,'retryable',false)),lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF b.financial_revision<>job.financial_revision OR (job.deal_id IS NOT NULL AND d.input_version<>job.input_version) THEN
  UPDATE public.operation SET status='succeeded',subphase='stale',result='{"kind":"blocked","outcome":"stale","findings":[{"code":"STALE_INPUT_VERSION","field":null,"message":"Inputs changed. Refresh before continuing.","blocking":true,"resolution":"refresh"}]}',lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF p_retry AND job.attempt<3 THEN
  UPDATE public.operation SET status='queued',subphase='retry_wait',available_at=clock_timestamp()+make_interval(secs=>power(2,job.attempt)::int),lease_token=NULL,lease_expires_at=NULL,version=version+1 WHERE id=p_id;
 ELSE
  UPDATE public.operation SET status=CASE WHEN p_result->>'kind'='failed' THEN 'failed' ELSE 'succeeded' END,
   subphase='finished',result=p_result,lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 END IF;
 IF job.kind='evaluate' AND d.status='computing' THEN
  IF job.cancellation_requested OR b.financial_revision<>job.financial_revision OR d.input_version<>job.input_version OR p_result->>'kind'='blocked' THEN
   UPDATE public.deal SET status='awaiting_confirm' WHERE id=job.deal_id;
  ELSIF NOT EXISTS(SELECT FROM public.operation_context(p_id,p_token)) AND EXISTS(SELECT FROM public.operation WHERE id=p_id AND status='failed') THEN
   UPDATE public.deal SET status='failed' WHERE id=job.deal_id;
  END IF;
 END IF;
 INSERT INTO public.operation_log(business_id,deal_id,actor,actor_user_id,action,outcome,payload)
 VALUES(job.business_id,job.deal_id,'system',job.actor_user_id,'operation_finish','completed',jsonb_build_object('operation_id',p_id));
 PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION operation_finish(uuid,uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operation_finish(uuid,uuid,jsonb,boolean) TO orderfit_worker;
