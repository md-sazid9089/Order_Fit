"""Immutable negotiation preparation and reviewed reply/acceptance evidence."""
from pathlib import Path

from alembic import op

revision = "0007_p5_preparation"
down_revision = "0006_p3_input_integrity"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0008_p5_preparation.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Preparation evidence requires a forward repair")
