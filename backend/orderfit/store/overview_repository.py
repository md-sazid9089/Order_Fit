"""One tenant-scoped statement for a coherent, bounded dashboard snapshot."""

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.services.overview import build_overview

# Every source and join carries business_id; RLS is an additional boundary.
# Projected commitments replace their raw supplier costs; never count both.
OVERVIEW_SQL = text("""WITH b AS (
 SELECT id,currency,baseline_settings,financial_revision,
        (statement_timestamp() AT TIME ZONE timezone)::date AS today,
        statement_timestamp() AS now,
        COALESCE((SELECT safety_reserve_minor FROM owner_constraints oc
                  WHERE oc.business_id=business.id AND oc.id=business.default_constraints_id),0) AS reserve
 FROM business WHERE id=:b
), live AS (
 SELECT d.id AS deal_id,d.status AS workflow_status,e.id,e.created_at,
        d.public_ref,d.po_number,COALESCE(c.name,'Unknown customer') AS customer_name,
        COALESCE(e.inputs->'order'->>'order_value_minor','0') AS amount,
        e.inputs->'order' AS terms,
        CASE WHEN e.verdict='no_feasible_plan' THEN 'declined'
             WHEN o.borrowed_minor>0 THEN 'financing'
             WHEN COALESCE((o.levers->>'deposit_pct')::int,0)>0 THEN 'deposit'
             WHEN e.verdict='feasible_as_offered' THEN 'safe'
             ELSE 'unclassified' END AS category,
        (e.input_version IS DISTINCT FROM d.input_version OR
         e.financial_revision IS DISTINCT FROM b.financial_revision OR
         e.verdict<>'feasible_as_offered' OR
         COALESCE(jsonb_array_length(e.output->'alerts'),0)>0 OR
         EXISTS(SELECT FROM deal_flag f WHERE f.business_id=:b AND f.deal_id=d.id AND f.resolved_at IS NULL)) AS needs_review
 FROM deal d CROSS JOIN b
 JOIN evaluation e ON e.business_id=d.business_id AND e.deal_id=d.id AND e.superseded_at IS NULL
 LEFT JOIN evaluation_option o ON o.business_id=e.business_id AND o.evaluation_id=e.id
                              AND o.option_key=e.recommended_option_key
 LEFT JOIN customer c ON c.business_id=d.business_id AND c.id=d.customer_id
 WHERE d.business_id=:b
), volumes AS (
 SELECT DISTINCT ON (e.deal_id, (e.created_at>=b.now-interval '30 days'))
        e.deal_id,(e.created_at>=b.now-interval '30 days') AS current_period,
        (e.inputs->'order'->>'order_value_minor')::numeric AS amount
 FROM evaluation e CROSS JOIN b
 WHERE e.business_id=:b AND e.created_at>=b.now-interval '60 days' AND e.created_at<=b.now
 ORDER BY e.deal_id,(e.created_at>=b.now-interval '30 days'),e.created_at DESC,e.id DESC
), daily AS (
 SELECT ce.event_date,ce.direction,
        (ce.kind IN ('order_receipt','order_final_receipt','order_stage_receipt')) AS delayed,
        sum(ce.amount_minor) AS amount
 FROM cash_event ce CROSS JOIN b
 WHERE ce.business_id=:b AND ce.voided_at IS NULL
 AND (ce.deal_id IS NULL OR EXISTS(
     SELECT FROM commitment_projection cp WHERE cp.business_id=:b AND cp.cash_event_id=ce.id))
 GROUP BY ce.event_date,ce.direction,delayed
)
SELECT b.*,
 (SELECT count(DISTINCT deal_id) FROM evaluation WHERE business_id=:b) AS tested,
 (SELECT count(*) FROM deal d WHERE d.business_id=:b AND d.status NOT IN ('closed','committed','failed')
   AND (NOT EXISTS(SELECT FROM live l WHERE l.deal_id=d.id) OR
        EXISTS(SELECT FROM live l WHERE l.deal_id=d.id AND l.needs_review))) AS pending,
 COALESCE((SELECT sum(amount) FROM volumes WHERE current_period),0) AS volume,
 COALESCE((SELECT sum(amount) FROM volumes WHERE NOT current_period),0) AS previous_volume,
 COALESCE((SELECT jsonb_object_agg(category,n) FROM
    (SELECT category,count(*) AS n FROM live GROUP BY category) counts),'{}'::jsonb) AS distribution,
 COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM
    (SELECT * FROM live ORDER BY created_at DESC,id DESC LIMIT 5) r),'[]'::jsonb) AS recent,
 COALESCE((SELECT jsonb_agg(to_jsonb(daily) ORDER BY event_date,direction) FROM daily),'[]'::jsonb) AS events
FROM b
""")


class OverviewRepository:
    @staticmethod
    def get_overview(c, business_id, timeframe="30d", currency=None):
        row = c.execute(OVERVIEW_SQL, {"b": business_id}).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        return build_overview(row, timeframe, currency)
