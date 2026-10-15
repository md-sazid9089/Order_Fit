"""Manual P2 benchmark: python -m tests.engine.benchmark_engine (no provider/DB)."""

import json
import sys
from copy import deepcopy
from datetime import timedelta
from time import perf_counter, process_time

from orderfit.engine import analyse
from orderfit.engine.models import EngineInput

from .reference_adapter import fixture_input, load


def peak_process_rss():
    """OS process lifetime peak, including imports and retained previous results."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
                (name, ctypes.c_size_t)
                for name in (
                    "PeakWorkingSetSize",
                    "WorkingSetSize",
                    "QuotaPeakPagedPoolUsage",
                    "QuotaPagedPoolUsage",
                    "QuotaPeakNonPagedPoolUsage",
                    "QuotaNonPagedPoolUsage",
                    "PagefileUsage",
                    "PeakPagefileUsage",
                )
            ]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        psapi.GetProcessMemoryInfo.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(Counters),
            wintypes.DWORD,
        ]
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        if not psapi.GetProcessMemoryInfo(
            kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb
        ):
            raise ctypes.WinError(ctypes.get_last_error())
        return counters.PeakWorkingSetSize
    import resource

    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak if sys.platform == "darwin" else peak * 1024


def main():
    normal = fixture_input(load("OF-02"))
    stress = normal.model_dump(mode="json", exclude_none=True)
    start = normal.as_of
    stress["opening_balance"] = 0
    stress["baseline_events"] = [
        {
            "id": "late",
            "date": (start + timedelta(days=700)).isoformat(),
            "amount": 1,
            "direction": "out",
            "kind": "rent",
        }
    ]
    stress["order"].update(
        revenue=1000,
        anchor_dates={
            "order": start.isoformat(),
            "delivery": (start + timedelta(days=2)).isoformat(),
        },
        terms={"anchor": "delivery", "days": 0},
        costs=[
            {
                "id": "cost",
                "date": (start + timedelta(days=1)).isoformat(),
                "amount": 10000,
                "kind": "supplier_payment",
                "incremental": True,
                "deferrable": False,
            }
        ],
        deposit_discount_bps=0,
        deposit_discount_bps_per_10pct=0,
    )
    stress["financing_offers"] = [
        {
            "offer_id": "bounded",
            "name": "Synthetic bounded grid",
            "shape": "term_loan",
            "interest_bps": 0,
            "fee_bps": 0,
            "fee_flat": 0,
            "fee_at": "repayment",
            "lead_days": 0,
            "min": 1,
            "max": 199,
            "step": 1,
            "term_days": 10,
        }
    ]
    stress["strategy_space"] = {
        "deposit_pcts": list(range(50)),
        "deposit_lead_days": 0,
        "extensions": [{"days": 0, "surcharge_bps": 0}],
        "offer_ids": ["bounded"],
    }
    stress["scenarios"] = {"downside": {}, "severe": {}}
    stress["owner"]["max_financing_cost"] = None
    stress["scan_days"] = 1
    stress["sensitivity"] = []
    heavy = deepcopy(stress)
    heavy["baseline_events"] = [
        {
            "id": f"late-{i}",
            "date": (start + timedelta(days=700)).isoformat(),
            "amount": 1,
            "direction": "out",
            "kind": "rent",
        }
        for i in range(900)
    ]
    rows = []
    for label, inputs in [
        ("OF-02", normal),
        ("10000-combination-boundary", EngineInput.model_validate(stress)),
        ("near-work-admission-ceiling", EngineInput.model_validate(heavy)),
    ]:
        began = perf_counter()
        cpu_began = process_time()
        result = analyse(inputs)
        elapsed = perf_counter() - began
        assert result.decision != "analysis_limit", result.diagnostics
        rows.append(
            {
                "input": label,
                "seconds": round(elapsed, 3),
                "cpu_seconds": round(process_time() - cpu_began, 3),
                "work_units": result.work_units,
                "candidates": len(result.catalogue),
                "series_points": sum(len(s) for c in result.catalogue for s in c.series.values()),
                "decision": result.decision,
            }
        )
    print(json.dumps({"cases": rows, "peak_process_rss_bytes": peak_process_rss()}, indent=2))


if __name__ == "__main__":
    main()
