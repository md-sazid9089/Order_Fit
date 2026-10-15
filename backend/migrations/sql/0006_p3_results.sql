-- P3 keeps lender provenance on the existing offer and series on the existing evaluation.
ALTER TABLE financing_offer
  ADD COLUMN lender_payee_id uuid,
  ADD COLUMN lender_payee_version integer,
  ADD COLUMN lender_account_id uuid,
  ADD COLUMN lender_account_version integer,
  ADD COLUMN evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT financing_offer_lender_pair CHECK (
    (lender_payee_id IS NOT NULL) = (lender_payee_version IS NOT NULL)
    AND (lender_account_id IS NOT NULL) = (lender_account_version IS NOT NULL)
    AND (lender_account_id IS NULL OR lender_payee_id IS NOT NULL)
  ),
  ADD CONSTRAINT financing_offer_lender_fk FOREIGN KEY (business_id,lender_payee_id)
    REFERENCES payee(business_id,id);
ALTER TABLE payee_bank_account ADD CONSTRAINT payee_bank_business_identity_uq
  UNIQUE(business_id,payee_id,id);
ALTER TABLE financing_offer ADD CONSTRAINT financing_offer_account_fk
  FOREIGN KEY (business_id,lender_payee_id,lender_account_id)
  REFERENCES payee_bank_account(business_id,payee_id,id);
ALTER TABLE cash_event ADD COLUMN evidence jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(evidence)='array');

CREATE TABLE evaluation_series (
  business_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  option_key text NOT NULL,
  scenario text NOT NULL CHECK (scenario IN ('base','downside','severe')),
  currency text NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
  exponent smallint NOT NULL CHECK (exponent=2),
  points jsonb NOT NULL CHECK (jsonb_typeof(points)='array'),
  PRIMARY KEY(evaluation_id,option_key,scenario),
  FOREIGN KEY(business_id,evaluation_id,option_key)
    REFERENCES evaluation_option(business_id,evaluation_id,option_key)
);
ALTER TABLE evaluation_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_series FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON evaluation_series
  USING (business_id=(SELECT app_business_id()))
  WITH CHECK (business_id=(SELECT app_business_id()));
CREATE POLICY platform_admin ON evaluation_series TO orderfit_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT ON evaluation_series TO orderfit_app;
GRANT SELECT ON evaluation_series TO orderfit_readonly;
