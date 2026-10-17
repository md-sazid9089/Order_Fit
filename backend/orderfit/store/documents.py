"""Private filesystem interface. P4 owns upload/MIME/parser services."""

import hashlib
import os
import secrets
from pathlib import Path
from uuid import UUID

MAX_DOCUMENT_BYTES = 25 * 1024 * 1024


class DocumentStorageUnavailable(RuntimeError):
    """Private document storage could not complete an operation."""


class DocumentIntegrityError(ValueError):
    """Storage bytes do not match their immutable database evidence identity."""


def read_verified_document(storage, business_id, deal_id, document_id, *, content_hash, size_bytes):
    """Verify every source read against DB evidence, including a backend's own checksum.

    Object metadata can be replaced with an object; only the immutable document row
    supplies the authoritative content identity. Callers authorize before this read.
    """
    try:
        content = storage.read(business_id, deal_id, document_id)
    except ValueError:
        raise DocumentIntegrityError("document integrity check failed") from None
    if len(content) != size_bytes or hashlib.sha256(content).digest() != bytes(content_hash):
        raise DocumentIntegrityError("document integrity check failed")
    return content


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
                    if size > MAX_DOCUMENT_BYTES:
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

    def writable(self):
        """Probe durable local write/delete access without leaving a file behind."""
        probe = self.root / (".ready-" + secrets.token_hex(8))
        created = False
        removed = False
        try:
            with probe.open("xb") as stream:
                created = True
                stream.write(b"ready")
                stream.flush()
                os.fsync(stream.fileno())
        except OSError:
            pass
        finally:
            if created:
                try:
                    probe.unlink()
                    removed = True
                except OSError:
                    pass
        return created and removed


def create_document_store(config):
    """Build the configured private store once for the API or worker process."""
    if config.document_storage_backend == "s3":
        from orderfit.store.s3_documents import S3PrivateDocuments

        return S3PrivateDocuments(
            bucket=config.document_s3_bucket,
            region=config.document_s3_region,
            endpoint_url=config.document_s3_endpoint_url,
            access_key_id=(
                config.document_s3_access_key_id.get_secret_value()
                if config.document_s3_access_key_id else None
            ),
            secret_access_key=(
                config.document_s3_secret_access_key.get_secret_value()
                if config.document_s3_secret_access_key else None
            ),
            addressing_style=config.document_s3_addressing_style,
        )
    return PrivateDocuments(config.document_dir)
