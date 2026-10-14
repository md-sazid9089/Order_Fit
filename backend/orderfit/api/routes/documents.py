"""Upload a document to a deal; stored by content hash."""

from fastapi import APIRouter

router = APIRouter(prefix="/deals", tags=["documents"])
