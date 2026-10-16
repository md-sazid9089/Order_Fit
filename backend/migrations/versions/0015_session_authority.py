"""Require fresh authentication after membership role changes without cross-session locks."""
from pathlib import Path

from alembic import op

revision = "0015_session_authority"
down_revision = "0014_settlement_retention"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0016_session_authority.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Removing reauthentication boundaries requires a reviewed forward migration")
