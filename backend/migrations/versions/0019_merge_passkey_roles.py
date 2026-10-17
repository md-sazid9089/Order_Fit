"""Join main's platform-authority/passkey line with the 0017_merge_heads role branch.

No schema change: the parents carry all SQL. Neon reached 0017_merge_heads (worker presence plus
0016_add_user_admin_roles); upgrading it applies 0017_platform_authority, 0018_passkey_mfa and this
revision only.
"""

revision = "0019_merge_passkey_roles"
down_revision = ("0018_passkey_mfa", "0017_merge_heads")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    raise RuntimeError("Passkey and platform authority require a reviewed forward migration")
