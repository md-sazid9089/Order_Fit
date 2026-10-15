"""Partial Core mappings for P1 queries. Never create/autogenerate DDL from these."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    LargeBinary,
    MetaData,
    String,
    Table,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB

metadata = MetaData()
business = Table(
    "business",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("name", String),
    Column("currency", String),
    Column("financial_revision", BigInteger),
    Column("version", Integer),
)
app_user = Table(
    "app_user",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("email", String),
    Column("full_name", String),
    Column("preferences", JSONB),
    Column("version", Integer),
)
membership = Table(
    "membership",
    metadata,
    Column("business_id", Uuid, primary_key=True),
    Column("user_id", Uuid, primary_key=True),
    Column("role", String),
    Column("version", Integer),
)
deal = Table(
    "deal",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("business_id", Uuid),
    Column("version", Integer),
    Column("input_version", BigInteger),
    Column("status", String),
)

operation = Table(
    "operation",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("business_id", Uuid),
    Column("deal_id", Uuid),
    Column("actor_user_id", Uuid),
    Column("session_id", Uuid),
    Column("kind", String),
    Column("status", String),
    Column("subphase", String),
    Column("version", Integer),
    Column("request_hash", LargeBinary),
    Column("input_version", BigInteger),
    Column("financial_revision", BigInteger),
    Column("snapshot_id", Uuid),
    Column("source_document_id", Uuid),
    Column("config_version", String),
    Column("result", JSONB),
    Column("cancellation_requested", Boolean),
    Column("queued_at", DateTime(timezone=True)),
    Column("started_at", DateTime(timezone=True)),
    Column("finished_at", DateTime(timezone=True)),
    Column("attempt", Integer),
    Column("available_at", DateTime(timezone=True)),
    Column("lease_owner", String),
    Column("lease_token", Uuid),
    Column("lease_expires_at", DateTime(timezone=True)),
)

input_snapshot = Table(
    "input_snapshot",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("business_id", Uuid),
    Column("deal_id", Uuid),
    Column("input_version", BigInteger),
    Column("financial_revision", BigInteger),
    Column("schema_version", String),
    Column("payload", JSONB),
    Column("canonical_payload", LargeBinary),
    Column("snapshot_hash", LargeBinary),
    Column("confirmed_by", Uuid),
    Column("confirmed_at", DateTime(timezone=True)),
)
