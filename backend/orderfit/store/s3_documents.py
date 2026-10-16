"""Private S3-compatible object storage for source documents.

Keys are derived only from validated business/deal/document UUIDs. The bucket must
remain private; API and worker use the same bucket and the same generated key format.
"""

import hashlib
from uuid import UUID, uuid4

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from orderfit.store.documents import MAX_DOCUMENT_BYTES, DocumentStorageUnavailable


class S3PrivateDocuments:
    def __init__(
        self,
        bucket,
        region,
        *,
        endpoint_url=None,
        access_key_id=None,
        secret_access_key=None,
        addressing_style="auto",
        s3_client=None,
    ):
        if not bucket or not region:
            raise ValueError("S3 document bucket and region are required")
        if bool(access_key_id) != bool(secret_access_key):
            raise ValueError("S3 access key and secret must be configured together")
        self.bucket = bucket
        self.s3 = s3_client or boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": addressing_style},
                retries={"mode": "standard", "total_max_attempts": 3},
                connect_timeout=5,
                read_timeout=15,
                max_pool_connections=4,
            ),
        )

    @staticmethod
    def _key(business_id, deal_id, document_id):
        # UUID parsing prevents traversal and cross-tenant key injection.
        return "/".join(
            str(UUID(str(value))) for value in (business_id, deal_id, document_id)
        )

    @staticmethod
    def _raise_storage_error(exc):
        code = exc.response.get("Error", {}).get("Code", "")
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if code in {"NoSuchKey", "NotFound", "404"} or status == 404:
            raise FileNotFoundError("private document not found") from None
        if code in {"PreconditionFailed", "ConditionalRequestConflict", "412"} or status == 412:
            raise FileExistsError("private document already exists") from None
        raise DocumentStorageUnavailable("document storage unavailable") from None

    def put(self, business_id, deal_id, document_id, chunks):
        key = self._key(business_id, deal_id, document_id)
        body, hasher, size = bytearray(), hashlib.sha256(), 0
        for chunk in chunks:
            if not isinstance(chunk, bytes):
                raise ValueError("document chunks must be bytes")
            size += len(chunk)
            if size > MAX_DOCUMENT_BYTES:
                raise ValueError("document exceeds 25 MiB")
            hasher.update(chunk)
            body.extend(chunk)
        if size == 0:
            raise ValueError("empty document")
        digest = hasher.hexdigest()
        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=bytes(body),
                IfNoneMatch="*",
                ServerSideEncryption="AES256",
                Metadata={"sha256": digest},
            )
        except ClientError as exc:
            self._raise_storage_error(exc)
        except BotoCoreError:
            raise DocumentStorageUnavailable("document storage unavailable") from None
        return key, digest, size

    def discard(self, business_id, deal_id, document_id):
        """Remove generated-key bytes when the enclosing database transaction failed."""
        key = self._key(business_id, deal_id, document_id)
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            self._raise_storage_error(exc)
        except BotoCoreError:
            raise DocumentStorageUnavailable("document storage unavailable") from None

    def read(self, business_id, deal_id, document_id):
        key = self._key(business_id, deal_id, document_id)
        try:
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            stream = response["Body"]
            try:
                if response.get("ContentLength", 0) > MAX_DOCUMENT_BYTES:
                    raise ValueError("stored document exceeds 25 MiB")
                content = stream.read(MAX_DOCUMENT_BYTES + 1)
            finally:
                stream.close()
        except ClientError as exc:
            self._raise_storage_error(exc)
        except BotoCoreError:
            raise DocumentStorageUnavailable("document storage unavailable") from None
        if len(content) > MAX_DOCUMENT_BYTES:
            raise ValueError("stored document exceeds 25 MiB")
        expected = response.get("Metadata", {}).get("sha256")
        if not expected or not hashlib.sha256(content).hexdigest() == expected:
            raise ValueError("stored document checksum mismatch")
        return content

    def writable(self):
        """Check object write/read/delete access with a private canary object."""
        key = "_orderfit/readiness/" + str(uuid4()) + ".probe"
        created = False
        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=b"ready",
                IfNoneMatch="*",
                ServerSideEncryption="AES256",
                Metadata={"purpose": "readiness"},
            )
            created = True
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            stream = response["Body"]
            try:
                verified = response.get("ContentLength") == 5 and stream.read(6) == b"ready"
            finally:
                stream.close()
            if not verified:
                return False
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            created = False
            return True
        except (BotoCoreError, ClientError):
            return False
        finally:
            if created:
                try:
                    self.s3.delete_object(Bucket=self.bucket, Key=key)
                except (BotoCoreError, ClientError):
                    pass
