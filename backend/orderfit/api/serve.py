"""API process entry point: uvicorn with deliberate, configured proxy trust.

uvicorn trusts X-Forwarded-For from 127.0.0.1 by default. Here forwarded headers are honored
only when TRUSTED_PROXY_IPS lists the proxies in front of the API; otherwise they are ignored
and the direct peer address is used (sign-in rate limits then see the proxy address).
"""

import argparse
import os

import uvicorn

from orderfit.contracts.configuration import RuntimeConfiguration


def proxy_options(trusted: list[str]) -> dict:
    if not trusted:
        return {"proxy_headers": False}
    return {"proxy_headers": True, "forwarded_allow_ips": ",".join(trusted)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = parser.parse_args()
    config = RuntimeConfiguration()
    uvicorn.run(
        "orderfit.api.main:app",
        host=args.host,
        port=args.port,
        timeout_graceful_shutdown=20,
        **proxy_options(config.trusted_proxy_ips),
    )


if __name__ == "__main__":
    main()
