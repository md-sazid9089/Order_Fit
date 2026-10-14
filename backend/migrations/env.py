"""Alembic environment. Database URL comes from settings (migration_url: the direct endpoint on Neon), never from alembic.ini."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from orderfit.config import settings
from orderfit.store.tables import metadata

config = context.config
# ConfigParser treats % as interpolation; escape it so passwords with % survive.
config.set_main_option("sqlalchemy.url", settings.migration_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = metadata

# Tables owned by LangGraph's checkpointer (created by AsyncPostgresSaver.setup()).
# Without this, autogenerate sees them as unknown and emits DROP TABLE.
EXTERNAL_TABLES = {"checkpoints", "checkpoint_blobs", "checkpoint_writes", "checkpoint_migrations"}


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    return not (type_ == "table" and reflected and name in EXTERNAL_TABLES)


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a connection (alembic upgrade head --sql)."""
    context.configure(
        url=settings.migration_url,
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
    run_migrations_offline()
else:
    run_migrations_online()
