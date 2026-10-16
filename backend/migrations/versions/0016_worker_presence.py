"""Durable expiring process liveness, separate from queue age."""
from pathlib import Path

from alembic import op

revision = "0016_worker_presence"
down_revision = "0015_session_authority"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[1] / "sql" / "0017_worker_presence.sql"
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Worker readiness requires a reviewed forward migration")
