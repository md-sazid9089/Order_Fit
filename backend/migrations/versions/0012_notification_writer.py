"""Notifications are written only by the SECURITY DEFINER p7_notify(); runtime keeps read_at."""
from pathlib import Path

from alembic import op

revision = "0012_notification_writer"
down_revision = "0011_p7_operations"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0013_notification_writer.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Restoring runtime notification INSERT reopens forged notices; use a reviewed forward repair")
