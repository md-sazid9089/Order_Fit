import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("CI pins external actions to immutable commits", () => {
  const workflow = ["tests.yml", "security.yml"].map(name =>
    readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8")).join("\n");
  const actions = [...workflow.matchAll(/uses:\s*(\S+)/g)].map(m => m[1]);
  assert.ok(actions.length >= 3);
  for (const action of actions) assert.match(action, /^[\w-]+\/[\w-]+(?:\/[\w-]+)*@[a-f0-9]{40}$/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /uv sync --frozen/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /--require-hashes --disable-pip --strict/);
  assert.match(workflow, /path: \$\{\{ runner.temp \}\}\/orderfit-runtime\.cdx\.json/);
  assert.match(workflow, /retention-days: 14/);
  assert.doesNotMatch(workflow, /pull_request_target|secrets: inherit|persist-credentials: true/);
});

test("Git and container contexts exclude local secrets and diagnostics", () => {
  const ignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
  for (const rule of [".env", ".env.*", "*.pem", "*.key", "*.log"]) {
    assert.ok(ignore.split(/\r?\n/).includes(rule));
  }
  for (const file of ["../../backend/.dockerignore", "../.dockerignore"]) {
    const rules = readFileSync(new URL(file, import.meta.url), "utf8").split(/\r?\n/);
    assert.ok(rules.includes(".env") && rules.includes(".env.*"));
    for (const rule of ["*.log", "**/*.pem", "**/*.key", "**/*.p12", "**/id_rsa*", "**/.npmrc"]) {
      assert.ok(rules.includes(rule));
    }
  }
  const webRules = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8").split(/\r?\n/);
  for (const rule of ["test-results", "playwright-report", "acceptance-results"]) assert.ok(webRules.includes(rule));
});

test("web responses deny framing, object embeds, device access and HTTPS downgrade", async () => {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, process: { env: {} } });
  const routes = await mod.exports.default.headers();
  const headers = Object.fromEntries(routes.find(r => r.source === "/:path*").headers.map(h => [h.key, h.value]));
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000");
  for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(headers["Content-Security-Policy"].includes(directive));
  }
  for (const capability of ["camera", "microphone", "geolocation", "payment", "usb"]) {
    assert.ok(headers["Permissions-Policy"].includes(`${capability}=()`));
  }
});
