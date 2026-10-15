"""Join concurrent P3 fixes and P4 additions without changing either history."""

revision = "0005_p3_p4_integration"
down_revision = ("0004_p3_exports", "0004_p4_documents")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    raise RuntimeError("Immutable decision/extraction evidence requires a forward repair")
