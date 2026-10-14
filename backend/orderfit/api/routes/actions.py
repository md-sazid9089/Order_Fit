"""Owner actions: confirm figures, approve/edit/reject, submit a reply. Each write takes an Idempotency-Key header."""

from fastapi import APIRouter

router = APIRouter(prefix="/deals", tags=["actions"])
