import hashlib
from uuid import uuid4

import pytest

from orderfit.store.documents import PrivateDocuments


def test_private_bytes_restart_no_overwrite_and_scope(tmp_path):
    store = PrivateDocuments(str(tmp_path / "private"))
    ids = (uuid4(), uuid4(), uuid4())
    key, digest, size = store.put(*ids, [b"source", b" bytes"])
    assert key == "/".join(map(str, ids))
    assert digest == hashlib.sha256(b"source bytes").hexdigest() and size == 12
    assert PrivateDocuments(str(store.root)).read(*ids) == b"source bytes"
    with pytest.raises(FileExistsError):
        store.put(*ids, [b"replacement"])
    assert store.read(*ids) == b"source bytes"
    with pytest.raises(FileNotFoundError):
        store.read(uuid4(), ids[1], ids[2])
    with pytest.raises(ValueError):
        store.read("../../escape", ids[1], ids[2])
    assert not list(store.root.rglob("*.tmp"))


@pytest.mark.parametrize("chunks", [[], [b"x" * 26214401]])
def test_private_storage_limits_cleanup(tmp_path, chunks):
    store = PrivateDocuments(str(tmp_path))
    with pytest.raises(ValueError):
        store.put(uuid4(), uuid4(), uuid4(), chunks)
    assert not [p for p in tmp_path.rglob("*") if p.is_file()]
