"""Original documents on disk under DOCUMENT_DIR/<business_id>/<sha256>.
De-duplication is per business, never global."""


def save(business_id: str, content: bytes, filename: str) -> tuple[str, bool]:
    """Return (sha256, is_duplicate)."""
    raise NotImplementedError
