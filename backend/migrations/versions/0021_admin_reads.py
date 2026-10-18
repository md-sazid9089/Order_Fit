"""Bounded, session-authorized platform summary reads."""
from pathlib import Path

from alembic import op

revision = "0021_admin_reads"
down_revision = "0020_ai_workflow"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[1] / "sql" / "0021_admin_reads.sql"
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Administrative grants require a reviewed forward repair")
