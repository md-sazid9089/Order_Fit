"""P1 identity, scoped operations and revision foundation; applied 0001 is untouched."""

from pathlib import Path

from alembic import op

revision = "0002_backend_foundation"
down_revision = "0001_core_schema"
branch_labels = None
depends_on = None


def upgrade():
    # Preserve 0001's parameterless DBAPI execution for SQL percent/colon syntax.
    source = Path(__file__).resolve().parents[1] / "sql" / "0005_backend_foundation.sql"
    with op.get_bind().connection.cursor() as cursor:
        cursor.execute(source.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError(
        "Foundation rollback requires a reviewed forward repair; no destructive downgrade"
    )
