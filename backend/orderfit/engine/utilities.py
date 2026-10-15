"""Pure canonical data helpers, no filesystem or clock access."""

import copy
from datetime import date


def d(value):
    return value if type(value) is date else date.fromisoformat(value)


def get_path(obj, path):
    for part in path.split("."):
        obj = obj[part]
    return obj


def set_path(obj, path, value):
    parts = path.split(".")
    for part in parts[:-1]:
        obj = obj[part]
    obj[parts[-1]] = value


def deep_copy(value):
    result = copy.deepcopy({k: v for k, v in value.items() if not k.startswith("_")})
    if "_budget" in value:
        result["_budget"] = value["_budget"]
    return result
