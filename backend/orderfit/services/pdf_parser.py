"""Disposable PDF parser. No document bytes or parser diagnostics reach logs."""

import json
import sys
from dataclasses import asdict

from orderfit.store.documents import MAX_DOCUMENT_BYTES
from orderfit.workflow.compute_limits import limit_memory


def main():
    # Keep the Windows job handle alive until exit. POSIX uses RLIMIT_AS.
    memory_guard = limit_memory(384 * 1024 * 1024)
    from orderfit.services.documents import parse_pdf_child

    data = sys.stdin.buffer.read(MAX_DOCUMENT_BYTES + 1)
    if len(data) > MAX_DOCUMENT_BYTES:
        return 1
    result = parse_pdf_child(data)
    sys.stdout.buffer.write(json.dumps(asdict(result), ensure_ascii=True).encode("ascii"))
    del memory_guard
    return 0


if __name__ == "__main__":
    sys.exit(main())
