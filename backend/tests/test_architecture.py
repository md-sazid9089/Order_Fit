"""Layer boundaries, checked by reading imports (no code is executed).

- engine/ imports only stdlib, pydantic and itself.
- only agent/nodes/compute.py imports the engine's analyse().
- only agent/llm.py may import an AI provider SDK.
"""

import ast
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1] / "orderfit"

ENGINE_ALLOWED_THIRD_PARTY = {"pydantic", "pydantic_core"}
AI_SDKS = {"anthropic", "openai", "langchain_anthropic", "langchain_openai", "google"}


def _imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module)
    return names


def _py_files(sub: str) -> list[Path]:
    return sorted((PKG / sub).rglob("*.py"))


def test_engine_imports_only_stdlib_pydantic_and_itself():
    offenders = []
    for path in _py_files("engine"):
        for name in _imports(path):
            top = name.split(".")[0]
            if name.startswith("orderfit.engine"):
                continue
            if top in sys.stdlib_module_names or top in ENGINE_ALLOWED_THIRD_PARTY:
                continue
            offenders.append(f"{path.relative_to(PKG)}: {name}")
    assert not offenders, "engine/ must stay pure:\n" + "\n".join(offenders)


def _engine_entry_offenders(tree) -> list[str]:
    """Every spelling that reaches the engine entry point: analyse, calculate or the module."""
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.level == 0:
            names = {alias.name for alias in node.names}
            if node.module == "orderfit.engine" and names & {"analyse", "calculate", "*"}:
                found.append(f"from {node.module} import {sorted(names)}")
            elif node.module == "orderfit.engine.analyse" and names & {"analyse", "calculate", "*"}:
                found.append(f"from {node.module} import {sorted(names)}")
            elif node.module == "orderfit" and "engine" in names:
                found.append("from orderfit import engine")
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in {"orderfit.engine", "orderfit.engine.analyse"}:
                    found.append(f"import {alias.name}")
    return found


def test_only_compute_node_calls_engine_analyse():
    allowed = {PKG / "agent" / "nodes" / "compute.py", PKG / "engine" / "__init__.py"}
    offenders = []
    for path in PKG.rglob("*.py"):
        if path in allowed or path.is_relative_to(PKG / "engine"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        offenders += [f"{path.relative_to(PKG)}: {why}" for why in _engine_entry_offenders(tree)]
    assert not offenders, "only agent/nodes/compute.py may reach analyse:\n" + "\n".join(offenders)


def test_entry_point_detector_catches_every_import_spelling():
    for source in (
        "import orderfit.engine\norderfit.engine.analyse(x)",
        "import orderfit.engine.analyse as m",
        "from orderfit.engine.analyse import calculate",
        "from orderfit.engine import analyse",
        "from orderfit.engine import *",
        "from orderfit import engine",
    ):
        assert _engine_entry_offenders(ast.parse(source)), source
    assert not _engine_entry_offenders(ast.parse("from orderfit.engine.models import Result"))


def test_only_llm_module_imports_ai_sdk():
    allowed = PKG / "agent" / "llm.py"
    offenders = []
    for path in PKG.rglob("*.py"):
        if path == allowed:
            continue
        for name in _imports(path):
            if name.split(".")[0] in AI_SDKS:
                offenders.append(f"{path.relative_to(PKG)}: {name}")
    assert not offenders, "AI SDKs belong in agent/llm.py only:\n" + "\n".join(offenders)
