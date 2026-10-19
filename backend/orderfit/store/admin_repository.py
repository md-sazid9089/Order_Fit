"""Only fixed, session-authorized database functions can read global summaries."""

from pydantic import ValidationError
from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.admin import AdminOrder, AdminOverview, AdminTenant, AdminUser
from orderfit.store.db import SCHEMA_REVISION, Scope, digest_token

FUNCTIONS = {
    "identity": "admin_read_identity(bytea)",
    "overview": "admin_read_overview(bytea)",
    "users": "admin_read_users(bytea,integer,uuid)",
    "tenants": "admin_read_tenants(bytea,integer,timestamptz,uuid)",
    "orders": "admin_read_orders(bytea,integer,timestamptz,uuid)",
}
MODELS = {"users": AdminUser, "tenants": AdminTenant, "orders": AdminOrder}
READ_COLUMNS = {
    "app_user": ("id", "email", "full_name", "is_platform_admin", "status", "created_at", "version"),
    "auth_session": ("id", "user_id", "token_digest"),
    "business": ("id", "name", "currency", "timezone", "status", "created_at"),
    "deal": ("id", "business_id", "status", "currency", "order_value_minor", "created_at"),
    "membership": ("user_id", "business_id", "role", "created_at", "version", "revoked_at"),
}


def prerequisites(c):
    """Catalog-only checks: no global row reads or permission changes."""
    return c.execute(text(
        "SELECT coalesce((SELECT version_num=:revision FROM alembic_version),false) "
        "AND NOT pg_has_role(current_user,'orderfit_admin_reader','MEMBER') "
        "AND NOT pg_has_role(current_user,'orderfit_worker','USAGE') "
        "AND NOT has_schema_privilege('orderfit_admin_reader','public','CREATE') "
        "AND NOT EXISTS(SELECT FROM pg_roles WHERE rolname IN ('orderfit_admin_reader','orderfit_admin_api') "
        "AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) "
        "AND (SELECT count(*) FROM pg_policies WHERE schemaname='public' "
        "AND tablename IN ('app_user','auth_session','business','deal','membership') AND policyname='admin_summary_read' "
        "AND cmd='SELECT' AND roles=ARRAY['orderfit_admin_reader']::name[] AND qual='true')=5 "
        "AND has_column_privilege('orderfit_admin_reader','public.app_user','id','UPDATE') "
        "AND has_column_privilege('orderfit_admin_reader','public.auth_session','id','UPDATE') "
        "AND has_function_privilege('orderfit_admin_reader','public.session_resolve(bytea)','EXECUTE') "
        "AND (SELECT bool_and(has_column_privilege('orderfit_admin_reader',"
        "'public.'||split_part(item,'.',1),split_part(item,'.',2),'SELECT')) "
        "FROM unnest(CAST(:columns AS text[])) AS required(item)) "
        "AND (SELECT bool_and(coalesce(has_function_privilege(current_user,to_regprocedure(fn),'EXECUTE'),false)) "
        "FROM unnest(CAST(:functions AS text[])) AS f(fn))"
    ), {"revision": SCHEMA_REVISION,
        "columns": [table + "." + column for table, columns in READ_COLUMNS.items() for column in columns],
        "functions": ["public." + signature for signature in FUNCTIONS.values()]}).scalar_one() is True


def identity(c, token):
    row = c.execute(text("SELECT * FROM public.admin_read_identity(:digest)"),
                    {"digest": digest_token(token)}).mappings().one()
    return Scope(row["user_id"], row["session_id"])


def _validated(model, data):
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise ApplicationError(503, "ADMIN_DATA_UNSUPPORTED",
                               "Recorded administrative data cannot be displayed safely.") from exc


def overview(c, token):
    data = c.execute(text("SELECT public.admin_read_overview(:digest)"),
                     {"digest": digest_token(token)}).scalar_one()
    return _validated(AdminOverview, data)


def listing(c, token, name, limit, position):
    # name comes only from fixed route handlers, never interpolated request input.
    if name not in MODELS:
        raise ValueError("Unknown admin listing")
    params = {"digest": digest_token(token), "limit": limit}
    if name == "users":
        params["id"] = position[0] if position else None
        query = "SELECT public.admin_read_users(:digest,:limit,CAST(:id AS uuid))"
    else:
        params.update(at=position[0] if position else None, id=position[1] if position else None)
        query = (f"SELECT public.admin_read_{name}(:digest,:limit,"
                 "CAST(:at AS timestamptz),CAST(:id AS uuid))")
    data = c.execute(text(query), params).scalar_one()
    return [_validated(MODELS[name], row) for row in data]
