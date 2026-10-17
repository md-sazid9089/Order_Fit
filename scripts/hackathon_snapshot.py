"""Record reproducible source identity without reading ignored runtime secrets."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = ("backend/", "web/", "scripts/", ".github/", "docker-compose.yml")


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def tree_digest(paths: list[str]) -> str:
    digest = hashlib.sha256()
    for name in sorted(paths):
        path = ROOT / name
        digest.update(name.encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest() if path.is_file() else b"deleted")
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    names = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").decode().split("\0")
    source = [name for name in names if name and name.startswith(SOURCE_ROOTS)]
    frontend = [name for name in source if name.startswith("web/")]
    manifest = {
        "head": git("rev-parse", "HEAD").decode().strip(),
        "branch": git("branch", "--show-current").decode().strip(),
        "source_sha256": tree_digest(source),
        "frontend_sha256": tree_digest(frontend),
        "tracked_diff_sha256": hashlib.sha256(git("diff", "--binary", "HEAD")).hexdigest(),
        "source_files": len(source),
        "status": git("status", "--short", "--untracked-files=all").decode().splitlines(),
        "identity_scope": "source includes tracked and nonignored untracked backend/web/scripts/CI/compose; docs excluded to avoid self-reference; diff hash covers tracked changes only",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: manifest[key] for key in ("head", "source_sha256", "frontend_sha256")}))


if __name__ == "__main__":
    main()
