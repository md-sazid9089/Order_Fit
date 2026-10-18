-- Additive AI workflow evidence. Nothing here grants authority: language provenance and glosses
-- are reviewer aids, and advisory rows are hypotheses/explanations tied to a stored evaluation.

-- C6: page-level language/script of the source page and an optional reviewer-only English gloss.
-- extraction_candidate stays immutable; these are written with the row and never updated.
ALTER TABLE extraction_candidate
 ADD COLUMN page_language text CHECK (page_language IS NULL OR page_language ~ '^[A-Za-z][A-Za-z-]{1,15}$'),
 ADD COLUMN page_script text CHECK (page_script IS NULL OR page_script ~ '^[A-Za-z]{3,16}$'),
 ADD COLUMN gloss_en text CHECK (gloss_en IS NULL OR length(gloss_en) <= 300);

-- C3/C5: immutable model-assisted advisory evidence (clause hypotheses, slot explanations).
CREATE TABLE ai_advisory (
 id uuid PRIMARY KEY,
 business_id uuid NOT NULL,
 deal_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('explanation','clause_assessment')),
 evaluation_id uuid NOT NULL,
 option_key text CHECK (option_key IS NULL OR length(option_key) BETWEEN 1 AND 80),
 operation_id uuid NOT NULL UNIQUE,
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='explanation') = (option_key IS NOT NULL)),
 UNIQUE(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(business_id,deal_id,evaluation_id) REFERENCES evaluation(business_id,deal_id,id),
 FOREIGN KEY(business_id,operation_id) REFERENCES operation(business_id,id)
);
CREATE INDEX ai_advisory_scope_idx ON ai_advisory(business_id,deal_id,kind,created_at DESC);
CREATE INDEX ai_advisory_evaluation_idx ON ai_advisory(business_id,evaluation_id,kind,option_key,created_at DESC);

ALTER TABLE ai_advisory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_advisory FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_advisory USING (business_id=(SELECT app_business_id()))
 WITH CHECK (business_id=(SELECT app_business_id()));
GRANT SELECT,INSERT ON ai_advisory TO orderfit_app;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON ai_advisory
 FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- C3/C5 advisory jobs get their own operation kind; 'explain' stays unused.
DO $$ DECLARE c text; BEGIN
 SELECT conname INTO c FROM pg_constraint
  WHERE conrelid='public.operation'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) LIKE '%csv_preview%' AND pg_get_constraintdef(oid) LIKE '%kind%';
 IF c IS NULL THEN RAISE EXCEPTION 'operation kind constraint not found'; END IF;
 EXECUTE format('ALTER TABLE operation DROP CONSTRAINT %I',c);
END $$;
ALTER TABLE operation ADD CONSTRAINT operation_kind_check CHECK(kind IN
 ('extract','evaluate','explain','draft','whatif','reply','execute','csv_preview','advisory'));
