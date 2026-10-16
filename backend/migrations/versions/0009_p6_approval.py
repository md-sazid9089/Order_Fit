"""Exact-bundle approval repair: lock-free bundle guard, batch send pin, usability predicate."""
from pathlib import Path

from alembic import op

revision = "0009_p6_approval"
down_revision = "0008_p6_execution"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0010_p6_approval.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("P6 approval evidence requires a reviewed forward repair")
