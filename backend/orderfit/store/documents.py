"""Private filesystem interface. P4 owns upload/MIME/parser services."""

import hashlib
import os
import secrets
from pathlib import Path
from uuid import UUID


class PrivateDocuments:
    def __init__(self, root: str):
        if Path(root).is_symlink():
            raise ValueError("document root cannot be a symlink")
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, business_id, deal_id, document_id):
        path = (
            self.root
            / str(UUID(str(business_id)))
            / str(UUID(str(deal_id)))
            / str(UUID(str(document_id)))
        )
        for parent in (path.parent.parent, path.parent, path):
            if parent.is_symlink():
                raise ValueError("symlink storage path")
        if not path.resolve().is_relative_to(self.root):
            raise ValueError("storage path escaped root")
        return path

    def put(self, business_id, deal_id, document_id, chunks):
        target = self._path(business_id, deal_id, document_id)
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = target.with_name(target.name + "." + secrets.token_hex(8) + ".tmp")
        hasher, size = hashlib.sha256(), 0
        try:
            with temporary.open("xb") as stream:
                os.chmod(temporary, 0o600)
                for chunk in chunks:
                    size += len(chunk)
                    if size > 26214400:
                        raise ValueError("document exceeds 25 MiB")
                    hasher.update(chunk)
                    stream.write(chunk)
                if size == 0:
                    raise ValueError("empty document")
                stream.flush()
                os.fsync(stream.fileno())
            os.link(temporary, target)  # atomic publication; never replace existing evidence
            if os.name != "nt":
                descriptor = os.open(target.parent, os.O_DIRECTORY)
                try:
                    os.fsync(descriptor)
                finally:
                    os.close(descriptor)
            return str(target.relative_to(self.root)).replace("\\", "/"), hasher.hexdigest(), size
        finally:
            temporary.unlink(missing_ok=True)

    def discard(self, business_id, deal_id, document_id):
        """Remove a file whose database row was never committed (generated IDs only)."""
        self._path(business_id, deal_id, document_id).unlink(missing_ok=True)

    def read(self, business_id, deal_id, document_id):
        # Service authorizes scope before calling this generated-ID-only interface.
        return self._path(business_id, deal_id, document_id).read_bytes()
