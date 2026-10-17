"""OS working set for a known owned process; no command lines or environment reads."""
import sys


def process_alive(pid):
    """Check liveness, including exited Windows objects with outstanding handles."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        try:
            code = wintypes.DWORD()
            return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
        finally:
            kernel.CloseHandle(handle)
    import os

    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def kill_owned_tree(process):
    """Terminate only this live Popen's descendants, including the Windows shim."""
    if process.poll() is not None:
        return
    children = descendants(process.pid) - {process.pid}
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        for pid in children:
            handle = kernel.OpenProcess(1, False, pid)
            if handle:
                try:
                    kernel.TerminateProcess(handle, 1)
                finally:
                    kernel.CloseHandle(handle)
    else:
        import os
        import signal
        for pid in children:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    process.kill()
    process.wait(timeout=5)


def descendants(pid):
    """Includes Windows venv redirector children; measuring only Popen.pid misses Python."""
    parents = {}
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Entry(ctypes.Structure):
            _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD),
                ("pid", wintypes.DWORD), ("heap", ctypes.c_size_t), ("module", wintypes.DWORD),
                ("threads", wintypes.DWORD), ("parent", wintypes.DWORD),
                ("priority", wintypes.LONG), ("flags", wintypes.DWORD), ("name", wintypes.WCHAR * 260)]
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
        kernel.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(Entry)]
        kernel.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(Entry)]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        snapshot = kernel.CreateToolhelp32Snapshot(2, 0)
        if snapshot == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            entry = Entry()
            entry.dwSize = ctypes.sizeof(entry)
            more = kernel.Process32FirstW(snapshot, ctypes.byref(entry))
            while more:
                parents[entry.pid] = entry.parent
                more = kernel.Process32NextW(snapshot, ctypes.byref(entry))
        finally:
            kernel.CloseHandle(snapshot)
    else:
        from pathlib import Path
        for path in Path("/proc").glob("[0-9]*/status"):
            try:
                parents[int(path.parent.name)] = int(next(line.split()[1] for line in path.read_text().splitlines() if line.startswith("PPid:")))
            except (OSError, StopIteration):
                pass
    found = {pid}
    while added := {child for child, parent in parents.items() if parent in found} - found:
        found.update(added)
    return found


def resident_bytes(pid):
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
                (name, ctypes.c_size_t) for name in (
                    "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
                    "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage",
                    "PagefileUsage", "PeakPagefileUsage")]
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        handle = kernel.OpenProcess(0x410, False, pid)
        if not handle:
            return 0
        try:
            counters = Counters()
            counters.cb = ctypes.sizeof(counters)
            return counters.WorkingSetSize if psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb) else 0
        finally:
            kernel.CloseHandle(handle)
    from pathlib import Path
    try:
        status = (Path("/proc") / str(pid) / "status").read_text()
        return int(next(line.split()[1] for line in status.splitlines() if line.startswith("VmRSS:"))) * 1024
    except (OSError, StopIteration):
        return 0
