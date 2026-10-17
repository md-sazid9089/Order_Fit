from orderfit.container_entrypoint import normalize_container_database_urls


def test_container_entrypoint_replaces_only_windows_ca_path():
    environment = {
        "DATABASE_URL": (
            "postgresql+psycopg://app:secret@db.example/orderfit?"
            "sslmode=verify-full&sslrootcert=E%3A%5Ccerts%5Croot.pem"
        ),
        "WORKER_DATABASE_URL": "postgresql+psycopg://worker:secret@db.example/orderfit?sslmode=verify-full&sslrootcert=system",
    }

    normalized = normalize_container_database_urls(environment)

    assert "sslmode=verify-full" in normalized["DATABASE_URL"]
    assert "sslrootcert=%2Fopt%2Fvenv%2Flib%2Fpython3.12%2Fsite-packages%2Fcertifi%2Fcacert.pem" in normalized["DATABASE_URL"]
    assert normalized["WORKER_DATABASE_URL"] == environment["WORKER_DATABASE_URL"]
    assert environment["DATABASE_URL"] != normalized["DATABASE_URL"]
