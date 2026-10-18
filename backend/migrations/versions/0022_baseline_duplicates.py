"""Source-row identity and version-bound baseline duplicate reviews."""
from pathlib import Path

from alembic import op

revision = "0022_baseline_duplicates"
down_revision = "0021_admin_reads"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[1] / "sql" / "0022_baseline_duplicates.sql"
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Duplicate reviews and source claims require a reviewed forward repair")
