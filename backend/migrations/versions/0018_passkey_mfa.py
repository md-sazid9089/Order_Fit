"""Password plus verified WebAuthn, with private one-use ceremonies."""
from pathlib import Path

from alembic import op

revision = "0018_passkey_mfa"
down_revision = "0017_platform_authority"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[1] / "sql" / "0019_passkey_mfa.sql"
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("MFA requires a reviewed forward migration")
