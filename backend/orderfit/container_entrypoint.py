"""Normalize host-local CA paths only when the image runs on Linux.

The documented remote URL uses ``sslrootcert=system``.  A local operator can
also use a Windows certifi path while launching the host process.  That path is
not meaningful in the Linux image, so retain TLS verification and substitute
the image's bundled certifi file before starting the configured command.
"""

import os
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_WINDOWS_ABSOLUTE_PATH = re.compile(r"^[A-Za-z]:[\\/]")
_CONTAINER_CERTIFI_BUNDLE = "/opt/venv/lib/python3.12/site-packages/certifi/cacert.pem"


def normalize_container_database_urls(environment: dict[str, str]) -> dict[str, str]:
    """Replace only unusable Windows CA paths; never relax TLS verification."""
    normalized = environment.copy()
    for key in ("DATABASE_URL", "WORKER_DATABASE_URL", "DATABASE_URL_DIRECT"):
        value = normalized.get(key)
        if not value:
            continue
        parsed = urlsplit(value)
        query = parse_qsl(parsed.query, keep_blank_values=True)
        if not any(
            name == "sslrootcert" and _WINDOWS_ABSOLUTE_PATH.match(certificate)
            for name, certificate in query
        ):
            continue
        normalized_query = [
            (
                name,
                _CONTAINER_CERTIFI_BUNDLE
                if name == "sslrootcert" and _WINDOWS_ABSOLUTE_PATH.match(certificate)
                else certificate,
            )
            for name, certificate in query
        ]
        normalized[key] = urlunsplit(parsed._replace(query=urlencode(normalized_query)))
    return normalized


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("container entrypoint requires a command")
    os.execvpe(sys.argv[1], sys.argv[1:], normalize_container_database_urls(dict(os.environ)))


if __name__ == "__main__":
    main()
