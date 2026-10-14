"""Server-sent events: node progress for one deal."""

from fastapi import APIRouter

router = APIRouter(prefix="/deals", tags=["stream"])
