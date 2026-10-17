"""Process liveness is distinct from stale working-set counters on Windows."""

import subprocess
import sys
import time

from tests.process_memory import descendants, kill_owned_tree, process_alive


def test_owned_python_tree_is_dead_even_while_exited_popen_handle_is_retained():
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        assert process_alive(child.pid)
        # Let the Windows venv redirector create its actual interpreter child.
        deadline = time.monotonic() + 3
        while sys.platform == "win32" and len(descendants(child.pid)) == 1 and time.monotonic() < deadline:
            time.sleep(.01)
        owned = descendants(child.pid)
        kill_owned_tree(child)
        assert child.poll() is not None
        deadline = time.monotonic() + 5
        while any(process_alive(pid) for pid in owned) and time.monotonic() < deadline:
            time.sleep(.01)
        assert not any(process_alive(pid) for pid in owned)
    finally:
        kill_owned_tree(child)
