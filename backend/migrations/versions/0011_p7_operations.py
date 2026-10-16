"""P7 supporting operations: invitations, account evidence, notifications, exports, readiness."""
from pathlib import Path

from alembic import op

revision = "0011_p7_operations"
down_revision = "0010_p6_execution_runtime"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0012_p7_operations.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("P7 membership, verification and notification evidence requires a reviewed forward repair")
