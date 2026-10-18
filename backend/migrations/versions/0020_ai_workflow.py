"""Language provenance for extraction candidates and immutable AI advisory evidence."""
from pathlib import Path

from alembic import op

revision = "0020_ai_workflow"
down_revision = "0019_merge_passkey_roles"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[1] / "sql" / "0020_ai_workflow.sql"
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("AI workflow evidence requires a reviewed forward repair")
