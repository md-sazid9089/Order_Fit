import pytest

from orderfit.runtime import process_environment


def test_runtime_launcher_filters_owner_and_provisioning_credentials():
    values = {
        "DATABASE_URL": "api-url",
        "DATABASE_URL_DIRECT": "owner-url",
        "WORKER_DATABASE_URL": "worker-url",
        "RUNTIME_PASSWORD": "provisioning-api-password",
        "WORKER_PASSWORD": "provisioning-worker-password",
        "SESSION_SECRET": "session-secret",
        "LLM_MODE": "off",
    }
    inherited = {
        "PATH": "system-path",
        "DATABASE_URL_DIRECT": "inherited-owner",
        "OPENAI_API_KEY": "inherited-provider-secret",
        "DATABASE_URL": "inherited-api",
    }
    api = process_environment(values, inherited)
    worker = process_environment(values, inherited, worker=True)
    assert api == {
        "PATH": "system-path",
        "DATABASE_URL": "api-url",
        "SESSION_SECRET": "session-secret",
        "LLM_MODE": "off",
    }
    assert worker == api | {"DATABASE_URL": "worker-url"}


def test_runtime_worker_never_falls_back_to_api_or_owner():
    with pytest.raises(ValueError, match="WORKER_DATABASE_URL"):
        process_environment({"DATABASE_URL": "api-url"}, {}, worker=True)
