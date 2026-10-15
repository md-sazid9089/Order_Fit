"""Generate offline target OpenAPI, TypeScript and capability/ownership inventory.

Run: uv run python -m orderfit.contracts.export [--check]
No application import, environment loading, database or provider access.
"""

import argparse
import json
import re
from pathlib import Path

from pydantic.json_schema import models_json_schema

from .catalogue import ENDPOINTS
from .exports import DecisionRecordV1
from .financial import ConfirmedInputV1
from .language import LanguageRequest, LanguageResult, TypedJSONImportV1
from .protocol import IdempotencyMaterial
from .resources import DocumentUpload
from .workflow import ActionBundleV1, ErrorEnvelope

DEST = Path(__file__).resolve().parents[3] / "docs" / "contracts"


def ref(model):
    return {"$ref": f"#/components/schemas/{model.__name__}"}


def build_openapi():
    models = {
        ConfirmedInputV1,
        DecisionRecordV1,
        ActionBundleV1,
        IdempotencyMaterial,
        ErrorEnvelope,
        LanguageRequest,
        LanguageResult,
        TypedJSONImportV1,
    }
    for endpoint in ENDPOINTS:
        models.add(endpoint.response)
        if endpoint.request:
            models.add(endpoint.request)
    # Pydantic's generic $defs names differ from class names; use its returned refs.
    refs, schema = models_json_schema(
        [(m, "validation") for m in sorted(models, key=lambda m: m.__name__)],
        ref_template="#/components/schemas/{model}",
    )
    definitions = schema["$defs"]

    def model_ref(model):
        return refs[(model, "validation")]

    paths = {}
    for endpoint in ENDPOINTS:
        parameters = []
        for name in re.findall(r"\{(\w+)\}", endpoint.path):
            shape = {"type": "string", "format": "uuid"}
            if name in {"event_id", "flag_id", "notification_id"}:
                shape = {"type": "string", "pattern": r"^[1-9][0-9]*$", "maxLength": 19}
            parameters.append({"name": name, "in": "path", "required": True, "schema": shape})
        mutation = endpoint.method != "GET"
        if mutation:
            parameters.append(
                {
                    "name": "Idempotency-Key",
                    "in": "header",
                    "required": True,
                    "schema": {"type": "string", "minLength": 1, "maxLength": 200},
                    "description": "Tenant-global scope; replay requires same actor/method/path/canonical body. Auth routes use restricted identity scope before a business exists.",
                }
            )
            parameters.append(
                {
                    "name": "X-CSRF-Token",
                    "in": "header",
                    "required": True,
                    "schema": {"type": "string"},
                }
            )
        if endpoint.collection:
            parameters += [
                {
                    "name": "cursor",
                    "in": "query",
                    "required": False,
                    "schema": {"type": "string", "maxLength": 2048},
                },
                {
                    "name": "limit",
                    "in": "query",
                    "required": False,
                    "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50},
                },
            ]
        queries = {
            "deals": {
                "search": {"type": "string", "maxLength": 100},
                "status": {"$ref": "#/components/schemas/DealStateFilter"},
            },
            "cash_events": {
                "deal_id": {"type": "string", "format": "uuid"},
                "scope": {"type": "string", "enum": ["baseline", "deal"]},
            },
            "customer_history": {"as_of": {"type": "string", "format": "date"}},
            "cash_flow": {
                "as_of": {"type": "string", "format": "date"},
                "through": {"type": "string", "format": "date"},
            },
            "evaluation_series": {
                "option_key": {"type": "string", "maxLength": 80},
                "scenario": {"type": "string", "enum": ["base", "downside", "severe"]},
            },
            "audit_export": {
                "from_sequence": {"type": "string", "pattern": "^[1-9][0-9]*$"},
                "to_sequence": {"type": "string", "pattern": "^[1-9][0-9]*$"},
            },
        }
        for name, shape in queries.get(endpoint.operation_id, {}).items():
            parameters.append(
                {
                    "name": name,
                    "in": "query",
                    "required": endpoint.operation_id
                    in {"customer_history", "cash_flow", "evaluation_series"},
                    "schema": shape,
                }
            )
        responses = {
            str(endpoint.status): {
                "description": "Target contract; implementation phase " + endpoint.phase,
                "content": {"application/json": {"schema": model_ref(endpoint.response)}},
            }
        }
        if endpoint.operation_id.endswith("download"):
            responses["200"]["content"] = {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            }
        if endpoint.status == 202:
            responses["202"]["headers"] = {
                "Location": {
                    "description": "Same durable operation poll URL",
                    "schema": {"type": "string"},
                }
            }
        for status in (400, 401, 403, 404, 409, 413, 415, 422, 429, 503):
            responses[str(status)] = {
                "description": "Curated safe error; never SQL/provider text",
                "content": {"application/json": {"schema": model_ref(ErrorEnvelope)}},
            }
        operation = {
            "operationId": endpoint.operation_id,
            "summary": endpoint.service,
            "description": "TARGET CONTRACT ONLY. Not mounted on deployed API. See x-implementation-phase.",
            "parameters": parameters,
            "responses": responses,
            "security": [] if endpoint.permission == "public" else [{"sessionCookie": []}],
            "x-permission": endpoint.permission,
            "x-service-owner": endpoint.service,
            "x-storage-owner": endpoint.storage.split(","),
            "x-implementation-phase": endpoint.phase,
            "x-acceptance-test": endpoint.verification,
        }
        if endpoint.request:
            media = "application/json"
            shape = model_ref(endpoint.request)
            if endpoint.multipart:
                media = "multipart/form-data"
                shape = {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["metadata", "file"],
                    "properties": {
                        "metadata": model_ref(DocumentUpload),
                        "file": {"type": "string", "format": "binary"},
                    },
                }
            operation["requestBody"] = {"required": True, "content": {media: {"schema": shape}}}
            if endpoint.multipart:
                operation["requestBody"]["content"][media]["encoding"] = {
                    "metadata": {"contentType": "application/json"}
                }
        paths.setdefault(endpoint.path, {})[endpoint.method.lower()] = operation
    definitions["DealStateFilter"] = {
        "type": "string",
        "enum": [
            "ingesting",
            "awaiting_confirm",
            "computing",
            "awaiting_approval",
            "awaiting_reply",
            "committed",
            "closed",
            "failed",
        ],
    }
    return {
        "openapi": "3.1.0",
        "info": {"title": "OrderFit target contracts (P0; not runtime API)", "version": "1.0.0"},
        "paths": paths,
        "components": {
            "schemas": definitions,
            "securitySchemes": {
                "sessionCookie": {"type": "apiKey", "in": "cookie", "name": "orderfit_session"}
            },
        },
    }


def ts_type(schema):
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[1]
    if "const" in schema:
        return json.dumps(schema["const"])
    if "enum" in schema:
        return " | ".join(json.dumps(v) for v in schema["enum"])
    for keyword in ("anyOf", "oneOf"):
        if keyword in schema:
            return " | ".join(ts_type(v) for v in schema[keyword])
    kind = schema.get("type")
    if kind in {"string", "boolean", "null"}:
        return kind
    if kind in {"integer", "number"}:
        return "number"
    if kind == "array":
        return f"ReadonlyArray<{ts_type(schema['items'])}>"
    if kind == "object":
        required = schema.get("required", [])
        fields = [
            f"readonly {json.dumps(k)}{'' if k in required else '?'}: {ts_type(v)};"
            for k, v in schema.get("properties", {}).items()
        ]
        if isinstance(schema.get("additionalProperties"), dict):
            fields.append(
                "readonly [key: string]: " + ts_type(schema["additionalProperties"]) + ";"
            )
        return "{ " + " ".join(fields) + " }" if fields else "Record<string, never>"
    raise ValueError(f"Unsupported schema in TypeScript generator: {schema}")


def build_types(spec):
    lines = [
        "// GENERATED from OpenAPI. Target contracts only; no runtime client or arithmetic.",
        "// Money/BIGINT IDs remain strings. Run python -m orderfit.contracts.export.",
    ]
    for name, schema in sorted(spec["components"]["schemas"].items()):
        lines.append(f"export type {name} = {ts_type(schema)};")
    lines.append("export interface Operations {")
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            req = op.get("requestBody", {}).get("content", {})
            request = ts_type(next(iter(req.values()))["schema"]) if req else "undefined"
            success = next(v for k, v in op["responses"].items() if int(k) < 300)
            response = ts_type(next(iter(success["content"].values()))["schema"])
            params = op["parameters"]
            groups = {}
            for location in ("path", "query", "header"):
                selected = [p for p in params if p["in"] == location]
                groups[location] = ts_type(
                    {
                        "type": "object",
                        "properties": {p["name"]: p["schema"] for p in selected},
                        "required": [p["name"] for p in selected if p["required"]],
                    }
                )
            lines.append(
                f'  readonly {op["operationId"]}: {{ readonly method: "{method.upper()}"; readonly path: "{path}"; readonly pathParams: {groups["path"]}; readonly query: {groups["query"]}; readonly headers: {groups["header"]}; readonly request: {request}; readonly response: {response}; readonly error: ErrorEnvelope }};'
            )
    lines.append("}")
    return "\n".join(lines) + "\n"


def artifacts():
    spec = build_openapi()
    rows = [
        "# Target capability ownership (generated)",
        "",
        "All business operations are planned, not deployed. Test column is the required phase gate, not a passed integration test.",
        "",
        "| Operation | Method/path | Permission | Service | Storage (reuse/addition per plan) | Phase | Gate |",
        "|---|---|---|---|---|---|---|",
    ]
    for e in ENDPOINTS:
        rows.append(
            f"| {e.operation_id} | `{e.method} {e.path}` | {e.permission} | `{e.service}` | {e.storage} | {e.phase} | {e.verification} |"
        )
    return {
        "openapi.json": json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        "frontend-api.d.ts": build_types(spec),
        "capability-ownership.md": "\n".join(rows) + "\n",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = {DEST / name: content for name, content in artifacts().items()}
    # Keep the browser's checked declaration inside its Docker build context.
    generated[DEST.parents[1] / "web" / "lib" / "generated-api.d.ts"] = generated[DEST / "frontend-api.d.ts"]
    for path, content in generated.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise SystemExit(f"Contract artifact drift: {path.name}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    print(f"contracts={'checked' if args.check else 'generated'} operations={len(ENDPOINTS)}")


if __name__ == "__main__":
    main()
