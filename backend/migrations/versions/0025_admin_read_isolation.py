"""Restore bounded platform summaries and private reader isolation after 0024."""

from pathlib import Path

from alembic import op

revision = "0025_admin_read_isolation"
down_revision = "0024_admin_user_management"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().connection.driver_connection.execute(
        (Path(__file__).resolve().parents[1] / "sql" / "0025_admin_read_isolation.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade():
    raise RuntimeError("Administrative isolation repairs require a reviewed forward migration")
