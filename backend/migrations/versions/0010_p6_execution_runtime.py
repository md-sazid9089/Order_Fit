"""P6-B sandbox execution: run admission/settlement, commitment gate, projection, compensation."""
from pathlib import Path

from alembic import op

revision = "0010_p6_execution_runtime"
down_revision = "0009_p6_approval"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0011_p6_execution_runtime.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("P6 execution and commitment evidence requires a reviewed forward repair")
