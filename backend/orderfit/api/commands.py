"""Shared route helpers: authorized reads and idempotent commands in one transaction."""

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.store.repositories import IdempotencyRepository


def read(request, business_id, permission, handler):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, permission, readonly=True) as (c, scope):
        return handler(c, scope, service)


def command(request, business_id, data, permission, handler, *, body_hash=None, cache=None):
    """Key reservation, command and audit commit together; replay returns the cached body.

    ``body_hash`` overrides the canonical body hash (secret-bearing bodies use a keyed
    digest). ``cache`` maps the result to the stored replay body (for one-time secrets).
    """
    service, key, _ = mutation(request)
    path = str(request.url.path)
    with service.database.tenant(session_token(request), business_id, permission) as (c, scope):
        fingerprint = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method=request.method,
                    path=path,
                    body_hash=body_hash or canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, path, fingerprint)
        if cached:
            return cached
        result = handler(c, scope, service)
        stored = cache(result) if cache else result
        IdempotencyRepository.complete(c, business_id, key, stored.model_dump(mode="json"))
        return result
