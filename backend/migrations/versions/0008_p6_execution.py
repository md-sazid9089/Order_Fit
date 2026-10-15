"""Exact bundle authorization and durable sandbox execution."""
from pathlib import Path

from alembic import op

revision = "0008_p6_execution"
down_revision = "0007_p5_preparation"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0009_p6_execution.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("P6 execution evidence requires a reviewed forward repair")
