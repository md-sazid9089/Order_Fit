"""P3 lender provenance and immutable evaluation series on existing records."""

from pathlib import Path

from alembic import op

revision = "0003_p3_results"
down_revision = "0002_backend_foundation"
branch_labels = None
depends_on = None


def upgrade():
    source = Path(__file__).resolve().parents[1] / "sql" / "0006_p3_results.sql"
    with op.get_bind().connection.cursor() as cursor:
        cursor.execute(source.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("P3 result history is immutable; use a reviewed forward repair")
