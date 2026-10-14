"""Create, get and list deals (scoped to the current business)."""

from fastapi import APIRouter

router = APIRouter(prefix="/deals", tags=["deals"])
