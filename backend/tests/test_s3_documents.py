"""S3 storage contract tests at the object-store boundary; no provider network calls."""

import hashlib
import io
from uuid import UUID

import boto3
import pytest
from botocore.response import StreamingBody
from botocore.stub import ANY, Stubber
from pydantic import ValidationError

from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.store.documents import create_document_store
from orderfit.store.s3_documents import S3PrivateDocuments

BUSINESS_ID = UUID("11111111-1111-4111-8111-111111111111")
DEAL_ID = UUID("22222222-2222-4222-8222-222222222222")
DOCUMENT_ID = UUID("33333333-3333-4333-8333-333333333333")
BUCKET = "orderfit-private-test"
REGION = "us-east-1"


def client():
    return boto3.client(
        "s3",
        region_name=REGION,
        endpoint_url="https://objects.example.invalid",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
    )


def test_s3_storage_uses_scoped_create_only_private_objects_and_reads_verified_bytes():
    source = b"synthetic private financial document"
    digest = hashlib.sha256(source).hexdigest()
    key = f"{BUSINESS_ID}/{DEAL_ID}/{DOCUMENT_ID}"
    s3 = client()
    with Stubber(s3) as stubber:
        stubber.add_response(
            "put_object",
            {"ETag": '"created"'},
            {
                "Bucket": BUCKET,
                "Key": key,
                "Body": source,
                "IfNoneMatch": "*",
                "ServerSideEncryption": "AES256",
                "Metadata": {"sha256": digest},
            },
        )
        stubber.add_response(
            "get_object",
            {
                "Body": StreamingBody(io.BytesIO(source), len(source)),
                "ContentLength": len(source),
                "Metadata": {"sha256": digest},
            },
            {"Bucket": BUCKET, "Key": key},
        )
        stubber.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": key})

        store = S3PrivateDocuments(BUCKET, REGION, s3_client=s3)
        assert store.put(BUSINESS_ID, DEAL_ID, DOCUMENT_ID, [source]) == (key, digest, len(source))
        assert store.read(BUSINESS_ID, DEAL_ID, DOCUMENT_ID) == source
        store.discard(BUSINESS_ID, DEAL_ID, DOCUMENT_ID)

        stubber.assert_no_pending_responses()


def test_s3_storage_rejects_replacement_and_maps_missing_objects_to_not_found():
    s3 = client()
    with Stubber(s3) as stubber:
        stubber.add_client_error(
            "put_object", service_error_code="PreconditionFailed", http_status_code=412
        )
        stubber.add_client_error(
            "get_object", service_error_code="NoSuchKey", http_status_code=404
        )
        store = S3PrivateDocuments(BUCKET, REGION, s3_client=s3)
        with pytest.raises(FileExistsError):
            store.put(BUSINESS_ID, DEAL_ID, DOCUMENT_ID, [b"replacement"])
        with pytest.raises(FileNotFoundError):
            store.read(BUSINESS_ID, DEAL_ID, DOCUMENT_ID)


def test_s3_storage_rejects_bad_scope_empty_and_oversized_objects():
    store = S3PrivateDocuments(BUCKET, REGION, s3_client=client())
    with pytest.raises(ValueError):
        store.put("../../other-tenant", DEAL_ID, DOCUMENT_ID, [b"x"])
    with pytest.raises(ValueError):
        store.put(BUSINESS_ID, DEAL_ID, DOCUMENT_ID, [])
    with pytest.raises(ValueError):
        store.put(BUSINESS_ID, DEAL_ID, DOCUMENT_ID, [b"x" * (25 * 1024 * 1024 + 1)])


def test_s3_storage_readiness_checks_object_write_and_delete_permissions():
    s3 = client()
    with Stubber(s3) as stubber:
        stubber.add_response(
            "put_object",
            {"ETag": '"probe"'},
            {
                "Bucket": BUCKET,
                "Key": ANY,
                "Body": b"ready",
                "IfNoneMatch": "*",
                "ServerSideEncryption": "AES256",
                "Metadata": {"purpose": "readiness"},
            },
        )
        stubber.add_response(
            "get_object",
            {
                "Body": StreamingBody(io.BytesIO(b"ready"), 5),
                "ContentLength": 5,
            },
            {"Bucket": BUCKET, "Key": ANY},
        )
        stubber.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ANY})
        assert S3PrivateDocuments(BUCKET, REGION, s3_client=s3).writable()
        stubber.assert_no_pending_responses()


def test_s3_storage_readiness_requires_read_access_and_removes_failed_probe():
    s3 = client()
    with Stubber(s3) as stubber:
        stubber.add_response(
            "put_object",
            {"ETag": '"probe"'},
            {
                "Bucket": BUCKET,
                "Key": ANY,
                "Body": b"ready",
                "IfNoneMatch": "*",
                "ServerSideEncryption": "AES256",
                "Metadata": {"purpose": "readiness"},
            },
        )
        stubber.add_client_error(
            "get_object", service_error_code="AccessDenied", http_status_code=403
        )
        stubber.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ANY})
        assert not S3PrivateDocuments(BUCKET, REGION, s3_client=s3).writable()
        stubber.assert_no_pending_responses()


def test_s3_runtime_configuration_requires_bucket_region_and_paired_credentials():
    base = {
        "database_url": "postgresql+psycopg://u:p@localhost/db",
        "session_secret": "s" * 48,
        "account_fingerprint_key": "f" * 48,
        "account_fingerprint_key_version": 1,
        "document_dir": ".",
        "allowed_origins": ["http://localhost:3000"],
        "document_storage_backend": "s3",
    }
    assert RuntimeConfiguration(**base, document_s3_bucket=BUCKET, document_s3_region=REGION)
    for bad in (
        {},
        {"document_s3_bucket": BUCKET},
        {"document_s3_region": REGION},
        {"document_s3_bucket": BUCKET, "document_s3_region": REGION,
         "document_s3_access_key_id": "access-only"},
    ):
        with pytest.raises(ValidationError):
            RuntimeConfiguration(**base, **bad)


def test_document_store_factory_builds_the_shared_s3_adapter():
    config = RuntimeConfiguration(
        database_url="postgresql+psycopg://u:p@localhost/db",
        session_secret="s" * 48,
        account_fingerprint_key="f" * 48,
        account_fingerprint_key_version=1,
        document_dir=".",
        document_storage_backend="s3",
        document_s3_bucket=BUCKET,
        document_s3_region=REGION,
        document_s3_access_key_id="test-access-key",
        document_s3_secret_access_key="test-secret-key",
        allowed_origins=["http://localhost:3000"],
    )
    store = create_document_store(config)
    assert isinstance(store, S3PrivateDocuments)
    assert store.bucket == BUCKET


def test_s3_storage_rejects_corrupt_content_and_maps_provider_errors():
    s3 = client()
    key = f"{BUSINESS_ID}/{DEAL_ID}/{DOCUMENT_ID}"
    with Stubber(s3) as stubber:
        stubber.add_response(
            "get_object",
            {
                "Body": StreamingBody(io.BytesIO(b"tampered"), 8),
                "ContentLength": 8,
                "Metadata": {"sha256": hashlib.sha256(b"original").hexdigest()},
            },
            {"Bucket": BUCKET, "Key": key},
        )
        stubber.add_client_error(
            "get_object", service_error_code="AccessDenied", http_status_code=403
        )
        store = S3PrivateDocuments(BUCKET, REGION, s3_client=s3)
        with pytest.raises(ValueError):
            store.read(BUSINESS_ID, DEAL_ID, DOCUMENT_ID)
        with pytest.raises(RuntimeError, match="document storage unavailable"):
            store.read(BUSINESS_ID, DEAL_ID, DOCUMENT_ID)
