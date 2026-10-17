"""Add user and admin roles to reference table app_role."""
from pathlib import Path

from alembic import op

revision = "0016_add_user_admin_roles"
down_revision = "0015_session_authority"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[1] / "sql" / "0016_add_user_admin_roles.sql"
    op.get_bind().connection.driver_connection.execute(sql.read_text(encoding="utf-8"))


def downgrade():
    op.execute("DELETE FROM app_role WHERE code IN ('user', 'admin');")
