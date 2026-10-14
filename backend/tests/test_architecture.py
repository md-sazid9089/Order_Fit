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


def test_only_compute_node_calls_engine_analyse():
    allowed = {PKG / "agent" / "nodes" / "compute.py", PKG / "engine" / "__init__.py"}
    offenders = []
    for path in PKG.rglob("*.py"):
        if path in allowed or path.is_relative_to(PKG / "engine"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module in {
                "orderfit.engine",
                "orderfit.engine.analyse",
            }:
                if any(alias.name == "analyse" for alias in node.names):
                    offenders.append(str(path.relative_to(PKG)))
    assert not offenders, "only agent/nodes/compute.py may import analyse:\n" + "\n".join(offenders)


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
