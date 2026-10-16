"""Invalidate sessions when platform authority changes."""
from pathlib import Path

from alembic import op

revision = "0017_platform_authority"
down_revision = "0016_worker_presence"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[1] / "sql" / "0018_platform_authority.sql"
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Authority revocation requires a reviewed forward migration")
