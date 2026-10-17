"""Join the worker-presence and user/admin-role branches that both follow 0015.

No schema change: the parents carry all SQL. Neon reached 0016_add_user_admin_roles from the
Ui-improve branch; upgrading it applies only 0016_worker_presence and this revision.
"""

revision = "0017_merge_heads"
down_revision = ("0016_worker_presence", "0016_add_user_admin_roles")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    raise RuntimeError("Worker readiness requires a reviewed forward migration")
