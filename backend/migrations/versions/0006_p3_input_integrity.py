"""Preserve reviewed cost identities across persistence and confirmation."""

from alembic import op

revision = "0006_p3_input_integrity"
down_revision = "0005_p3_p4_integration"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""ALTER TABLE cash_event
        ADD COLUMN cost_key text CHECK(cost_key IS NULL OR length(cost_key) BETWEEN 1 AND 2000),
        ADD COLUMN original_obligation_id text CHECK(original_obligation_id IS NULL OR length(original_obligation_id)>0)
    """)


def downgrade():
    raise RuntimeError("Reviewed financial identities require a forward repair")
