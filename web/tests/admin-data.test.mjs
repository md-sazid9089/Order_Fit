import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

class ApiError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
const mod = { exports: {} };
const source = ts.transpileModule(readFileSync(new URL("../lib/admin-data.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(source, { module: mod, exports: mod.exports, AbortController, URLSearchParams, setTimeout, clearTimeout, DOMException, require: name => name === "./platform-admin" ? { platformAdminEnabled: caps => caps?.read_enabled === true } : { ApiError } });
const { AdminData } = mod.exports;

test("transient session-lock conflicts retry bounded GETs and recover", async () => {
  let attempts = 0;
  const data = new AdminData(() => {}, async path => {
    if (path.endsWith("capabilities")) return { read_enabled: true };
    if (++attempts < 3) throw new ApiError("DEPENDENCY_UNAVAILABLE", 503);
    return { items: [{ id: "recovered" }], next_cursor: null };
  });
  await data.load("users");
  assert.equal(attempts, 3);
  assert.equal(data.state.rows[0].id, "recovered");
});

test("persistent transient failures stop after three attempts", async () => {
  let attempts = 0;
  const data = new AdminData(() => {}, async path => {
    if (path.endsWith("capabilities")) return { read_enabled: true };
    attempts++;
    throw new ApiError("DATABASE_CAPACITY", 503);
  });
  await data.load("users");
  assert.equal(attempts, 3);
  assert.equal(data.state.rows.length, 0);
  assert.match(data.state.message, /Retry/);
});

test("disabled capability issues no data requests and exposes no fabricated totals", async () => {
  const paths = [];
  const data = new AdminData(() => {}, async path => { paths.push(path); return { read_enabled: false }; });
  await data.load("overview");
  assert.deepEqual(paths, ["/admin/capabilities"]);
  assert.equal(data.state.overview, null);
  assert.match(data.state.message, /unavailable/);
});

test("overview and system fail independently", async () => {
  const data = new AdminData(() => {}, async path => {
    if (path.endsWith("capabilities")) return { read_enabled: true };
    if (path.endsWith("system")) throw new Error("offline");
    return { total_users: 12 };
  });
  await data.load("overview");
  assert.equal(data.state.overview.total_users, 12);
  assert.match(data.state.systemError, /Retry/);
  assert.equal(data.state.system, null);
});

test("opaque continuation is encoded and refresh returns to first page", async () => {
  const paths = [];
  let pages = 0;
  const data = new AdminData(() => {}, async path => {
    paths.push(path);
    if (path.endsWith("capabilities")) return { read_enabled: true };
    pages++;
    return { items: [{ id: String(pages) }], next_cursor: pages === 1 ? "a+/=&" : null };
  });
  await data.load("users");
  await data.load("users", true);
  assert.equal(data.state.rows.length, 2);
  assert.match(paths[3], /cursor=a%2B%2F%3D%26/);
  await data.load("users");
  assert.equal(data.state.rows.length, 1);
  assert.equal(paths.at(-1), "/admin/users?limit=50");
});

test("session reset aborts and fences late replies even if transport ignores abort", async () => {
  let resolve;
  const data = new AdminData(() => {}, () => new Promise(done => { resolve = done; }));
  const pending = data.load("users");
  data.clear();
  resolve({ read_enabled: true });
  await pending;
  assert.equal(data.state.enabled, false);
  assert.equal(data.state.rows.length, 0);
});

for (const [code, status, message] of [["FORBIDDEN", 403, /denied/], ["INVALID_SESSION", 401, /session ended/], ["INVALID_CURSOR", 422, /first page/], ["ADMIN_DATA_UNSUPPORTED", 503, /safely/], ["ADMIN_TELEMETRY_UNAVAILABLE", 503, /unavailable/]]) {
  test(`${code} clears loaded rows and gives a distinct safe state`, async () => {
    let fail = false;
    const data = new AdminData(() => {}, async path => {
      if (path.endsWith("capabilities")) return { read_enabled: true };
      if (fail) throw new ApiError(code, status);
      return { items: [{ id: "one" }], next_cursor: "next" };
    });
    await data.load("orders");
    fail = true;
    await data.load("orders", true);
    assert.equal(data.state.rows.length, 0);
    assert.match(data.state.message, message);
  });
}

test("global logs never poll the unsupported endpoint", async () => {
  const paths = [];
  const data = new AdminData(() => {}, async path => { paths.push(path); return { read_enabled: true }; });
  await data.load("logs");
  assert.deepEqual(paths, ["/admin/capabilities"]);
});
