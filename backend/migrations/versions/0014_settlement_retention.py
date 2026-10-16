"""Late-cancellation settlement context and idempotency-key retention for the runtime role."""
from pathlib import Path

from alembic import op

revision = "0014_settlement_retention"
down_revision = "0013_runtime_hardening"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0015_settlement_retention.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Restoring runtime deletion of live idempotency keys needs a reviewed forward repair")
