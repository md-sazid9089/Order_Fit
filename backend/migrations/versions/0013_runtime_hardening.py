"""Runtime hardening: split auth throttles, password lock order, narrowed business/document UPDATE."""
from pathlib import Path

from alembic import op

revision = "0013_runtime_hardening"
down_revision = "0012_notification_writer"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0014_runtime_hardening.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Restoring global auth throttles and blanket runtime UPDATE needs a reviewed forward repair")
