-- Preserve the two owner-selected stress haircuts that the P3 adapter previously dropped.
ALTER TABLE owner_constraints
  ADD COLUMN downside_order_receipt_haircut_bps integer NOT NULL DEFAULT 0
    CHECK (downside_order_receipt_haircut_bps BETWEEN 0 AND 10000),
  ADD COLUMN severe_order_receipt_haircut_bps integer NOT NULL DEFAULT 0
    CHECK (severe_order_receipt_haircut_bps BETWEEN 0 AND 10000);

-- These records reuse the authoritative snapshot/evaluation. They do not duplicate a ledger.
CREATE TABLE decision_export (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 26214400),
  content_hash bytea NOT NULL CHECK (octet_length(content_hash)=32 AND sha256(content)=content_hash),
  FOREIGN KEY (business_id,deal_id) REFERENCES deal(business_id,id),
  FOREIGN KEY (business_id,deal_id,evaluation_id) REFERENCES evaluation(business_id,deal_id,id),
  FOREIGN KEY (business_id,deal_id,snapshot_id) REFERENCES input_snapshot(business_id,deal_id,id),
  CHECK (expires_at > created_at)
);
CREATE INDEX decision_export_tenant_idx ON decision_export(business_id,id);
ALTER TABLE decision_export ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_export FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON decision_export
  USING (business_id=(SELECT app_business_id()))
  WITH CHECK (business_id=(SELECT app_business_id()));
CREATE POLICY platform_admin ON decision_export TO orderfit_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT ON decision_export TO orderfit_app;
GRANT SELECT ON decision_export TO orderfit_readonly;
CREATE TRIGGER decision_export_immutable BEFORE UPDATE OR DELETE ON decision_export
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER decision_export_no_truncate BEFORE TRUNCATE ON decision_export
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE TRIGGER evaluation_series_immutable BEFORE UPDATE OR DELETE ON evaluation_series
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER evaluation_series_no_truncate BEFORE TRUNCATE ON evaluation_series
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
