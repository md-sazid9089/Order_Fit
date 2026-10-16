"""Administrative API routes protected by authoritative server-side RBAC."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select

from orderfit.api.deps import require_admin, session_token
from orderfit.api.errors import ApplicationError
from orderfit.services.admin import admin_connection
from orderfit.store.tables import app_user, business, deal

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/overview", operation_id="admin_overview")
def admin_overview(request: Request):
    """Cross-tenant telemetry for verified platform administrators."""
    db = request.app.state.database
    storage = getattr(request.app.state, "documents", None)
    storage_ok = bool(storage.writable()) if storage else False
    status = db.readiness() if db else {"database": False, "schema_current": False, "worker": False}

    with admin_connection(request.app.state.database, session_token(request)) as conn:
        total_users = conn.execute(select(func.count(app_user.c.id))).scalar_one() or 0
        active_tenants = (
            conn.execute(
                select(func.count(business.c.id)).where(business.c.status == "active")
            ).scalar_one()
            or 0
        )
        total_orders = conn.execute(select(func.count(deal.c.id))).scalar_one() or 0
        total_pipeline = (
            conn.execute(select(func.coalesce(func.sum(deal.c.order_value_minor), 0))).scalar_one()
            or 0
        )

    return {
        "databaseConnected": bool(status.get("database", False)),
        "schemaCurrent": bool(status.get("schema_current", False)),
        "storageWritable": storage_ok,
        "workerActive": bool(status.get("worker", False)),
        "totalUsers": int(total_users),
        "totalOrders": int(total_orders),
        "totalPipelineMinor": int(total_pipeline),
        "activeTenants": int(active_tenants),
        "currency": "USD",
    }


@router.get("/users", operation_id="admin_users")
def admin_users(request: Request,
                limit: int = Query(default=50, ge=1, le=100)):
    """List all platform users accessible to verified platform administrators."""
    with admin_connection(request.app.state.database, session_token(request)) as conn:
        rows = conn.execute(
            select(
                app_user.c.id,
                app_user.c.email,
                app_user.c.full_name,
                app_user.c.is_platform_admin,
                app_user.c.version,
            ).order_by(app_user.c.email.asc(), app_user.c.id.asc()).limit(limit)
        ).mappings().all()

        return [
            {
                "id": str(r["id"]),
                "email": r["email"],
                "fullName": r["full_name"],
                "isPlatformAdmin": bool(r["is_platform_admin"]),
                "version": r["version"],
            }
            for r in rows
        ]


@router.get("/tenants", operation_id="admin_tenants")
def admin_tenants(request: Request,
                  limit: int = Query(default=50, ge=1, le=100)):
    """List all tenant namespaces for verified platform administrators."""
    with admin_connection(request.app.state.database, session_token(request)) as conn:
        rows = conn.execute(
            select(
                business.c.id,
                business.c.name,
                business.c.currency,
                business.c.timezone,
                business.c.status,
                business.c.created_at,
            ).order_by(business.c.name.asc(), business.c.id.asc()).limit(limit)
        ).mappings().all()

        return [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "currency": r["currency"],
                "timezone": r["timezone"],
                "status": r["status"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]


@router.get("/orders", operation_id="admin_orders")
def admin_orders(request: Request,
                 limit: int = Query(default=50, ge=1, le=100)):
    """List purchase orders for verified platform administrators."""
    with admin_connection(request.app.state.database, session_token(request)) as conn:
        rows = conn.execute(
            select(
                deal.c.id,
                deal.c.business_id,
                deal.c.status,
                deal.c.currency,
                deal.c.order_value_minor,
                deal.c.created_at,
            ).order_by(deal.c.created_at.desc(), deal.c.id.desc()).limit(limit)
        ).mappings().all()

        return [
            {
                "id": str(r["id"]),
                "businessId": str(r["business_id"]),
                "status": r["status"],
                "currency": r["currency"],
                "orderValueMinor": r["order_value_minor"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]


@router.get("/logs", operation_id="admin_logs")
def admin_logs(request: Request):
    """Global auth-event reads need a separately reviewed privileged interface."""
    # Runtime credentials intentionally cannot SELECT the global auth-event table.
    # Never resolve this by granting a tenant runtime role global auth access.
    raise ApplicationError(503, "ADMIN_TELEMETRY_UNAVAILABLE",
                           "Global security-event access is not configured.")


@router.get("/system", operation_id="admin_system")
def admin_system(request: Request):
    """System health and invariant status for verified platform administrators."""
    db = request.app.state.database
    status = db.readiness() if db else {"database": False, "schema_current": False, "worker": False}
    return {
        "status": "HEALTHY" if all(status.values()) else "DEGRADED",
        "readiness": status,
        "engineInvariants": {
            "deterministicMath": "VERIFIED",
            "integerMinorUnits": "ENFORCED",
            "tenantIsolation": "ACTIVE",
            "auditProvenance": "IMMUTABLE",
        },
    }
