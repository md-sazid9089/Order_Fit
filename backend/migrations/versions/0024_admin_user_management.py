"""Global admin user management, multi-tenant membership aggregation and overview metrics."""

from pathlib import Path

from alembic import op

revision = "0024_admin_user_management"
down_revision = "0023_account_access"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().connection.driver_connection.execute(
        (Path(__file__).resolve().parents[1] / "sql" / "0024_admin_user_management.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade():
    raise RuntimeError("Admin read telemetry changes require a reviewed forward migration")
