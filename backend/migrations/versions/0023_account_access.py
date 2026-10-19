"""Private account recovery, verified email and durable invitation delivery."""

from pathlib import Path

from alembic import op

revision = "0023_account_access"
down_revision = "0022_baseline_duplicates"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().connection.driver_connection.execute(
        (Path(__file__).resolve().parents[1] / "sql" / "0023_account_access.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade():
    raise RuntimeError("Account recovery evidence requires a reviewed forward repair")
