"""Online manual migrations; DATABASE_URL_DIRECT is injected only into this process."""

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
# ConfigParser treats % as interpolation; escape it so passwords with % survive.
migration_url = os.environ.get("DATABASE_URL_DIRECT")
if not migration_url:
    raise RuntimeError("DATABASE_URL_DIRECT is required for migrations")
config.set_main_option("sqlalchemy.url", migration_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The schema is raw SQL (backend/migrations/sql): triggers, RLS, generated columns and partial
# indexes that autogenerate cannot see. Comparing against partial store/tables.py mappings
# would emit incorrect schema changes, so autogenerate is switched off: with no
# target metadata, `alembic revision --autogenerate` refuses to run. Write migrations by hand.
target_metadata = None

# Tables owned by LangGraph's checkpointer (created by AsyncPostgresSaver.setup()).
# Without this, autogenerate sees them as unknown and emits DROP TABLE.
EXTERNAL_TABLES = {"checkpoints", "checkpoint_blobs", "checkpoint_writes", "checkpoint_migrations"}


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    return not (type_ == "table" and reflected and name in EXTERNAL_TABLES)


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a connection (alembic upgrade head --sql)."""
    context.configure(
        url=migration_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Raw SQL revisions require an online migration connection")
else:
    run_migrations_online()
