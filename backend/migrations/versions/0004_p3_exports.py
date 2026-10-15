"""P3 immutable decision records and preserved scenario policy fields."""

from pathlib import Path

from alembic import op

revision = "0004_p3_exports"
down_revision = "0003_p3_results"
branch_labels = None
depends_on = None


def upgrade():
    source = Path(__file__).resolve().parents[1] / "sql" / "0007_p3_exports.sql"
    with op.get_bind().connection.cursor() as cursor:
        cursor.execute(source.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("P3 decision evidence is immutable; use a reviewed forward repair")
