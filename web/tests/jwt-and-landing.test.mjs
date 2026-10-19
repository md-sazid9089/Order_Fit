import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, requires = {}, extra = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => requires[name] ?? (name === "./error-copy" ? load("error-copy.ts") : undefined), Event, ...extra });
  return mod.exports;
}

test("cookie sessions ignore legacy stored tokens and clear them on logout", async () => {
  const storage = { "orderfit.token": "legacy-jwt-token" };
  const calls = [];
  const client = load("orderfit-api.ts", { "./api": { API_URL: "http://orderfit.invalid" } }, {
    TextEncoder,
    localStorage: {
      getItem: k => storage[k] ?? null,
      setItem: (k, v) => { storage[k] = v; },
      removeItem: k => { delete storage[k]; },
    },
    sessionStorage: {
      get length() { return Object.keys(storage).length; },
      key: i => Object.keys(storage)[i] ?? null,
      getItem: k => storage[k] ?? null,
      setItem: (k, v) => { storage[k] = v; },
      removeItem: k => { delete storage[k]; },
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ token: "jwt-test-token" }) };
    },
  });

  await client.get("/auth/me");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.headers["Authorization"], undefined);

  client.clearStoredToken();
  assert.equal(storage["orderfit.token"], undefined);
});

test("session-store manages cached session and handles reset", () => {
  let resetListener = null;
  const store = load("session-store.ts", {
    "./session-reset": {
      registerSessionResetListener: fn => { resetListener = fn; },
    },
    "./orderfit-api": {
      SESSION_EXPIRED_EVENT: "orderfit:session-expired",
      ApiError: class ApiError extends Error {},
      get: async () => ({ user_id: "u1" }),
    },
  });

  assert.equal(store.getCachedSession(), null);

  const syntheticSession = { user_id: "user-123", email: "user@example.com", memberships: [] };
  store.setCachedSession(syntheticSession);
  assert.equal(store.getCachedSession(), syntheticSession);

  // Trigger reset listener
  assert.ok(typeof resetListener === "function");
  resetListener();
  assert.equal(store.getCachedSession(), null);
});

test("landing navbar renders dashboard link and profile when session is present", () => {
  const navbarSource = readFileSync(new URL("../components/landing/navbar.tsx", import.meta.url), "utf8");
  assert.ok(navbarSource.includes("useCurrentSession"), "navbar must check current session");
  assert.ok(navbarSource.includes("/deals"), "navbar must link to dashboard /deals when logged in");
  assert.ok(navbarSource.includes("Go to Dashboard"), "navbar must display Go to Dashboard");
});

test("hero section renders Go to Dashboard when session is present", () => {
  const heroSource = readFileSync(new URL("../components/landing/hero-section.tsx", import.meta.url), "utf8");
  assert.ok(heroSource.includes("useCurrentSession"), "hero must check current session");
  assert.ok(heroSource.includes("/deals"), "hero must link to dashboard /deals when logged in");
  assert.ok(heroSource.includes("Go to Dashboard"), "hero must display Go to Dashboard");
});


test("platform admin views are enabled for authorized platform administrators", () => {
  const admin = load("platform-admin.ts");
  assert.equal(admin.platformAdminEnabled(), true);
});

