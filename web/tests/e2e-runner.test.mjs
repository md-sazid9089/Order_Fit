import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../../scripts/run-e2e.ps1", import.meta.url), "utf8");

test("disposable E2E freezes every service image before provisioning", () => {
  assert.match(runner, /\$apiImage = "\$\{project\}-api:local"/);
  assert.match(runner, /\$webImage = "\$\{project\}-web:local"/);
  assert.match(runner, /foreach \(\$service in @\("api", "migrate", "provision", "worker"\)\)/);
  assert.match(runner, /image: \$apiImage/);
  assert.match(runner, /image: \$webImage/);
  assert.match(runner, /docker image tag orderfit-api:local \$apiImage/);
  assert.ok(runner.indexOf("docker image tag orderfit-api:local") < runner.indexOf('"--profile", "setup"'));
  for (const line of runner.split(/\r?\n/).filter(line => line.includes("& docker compose"))) {
    assert.match(line, /@composeFiles --project-name \$project --env-file \$tempEnv/);
  }
});

test("E2E cleanup removes only private run tags and temporary files", () => {
  assert.match(runner, /foreach \(\$testImage in @\(\$apiImage, \$webImage\)\)/);
  assert.match(runner, /docker image rm \$testImage/);
  assert.match(runner, /Remove-Item -LiteralPath \$tempCompose/);
  assert.doesNotMatch(runner, /docker (?:system|image|volume) prune|git (?:clean|reset)/);
  assert.match(runner, /\$testOutput = .*\$project-results/);
  assert.match(runner, /--workers=1 --output=\$testOutput/);
  assert.doesNotMatch(runner, /Remove-Item -LiteralPath \$testOutput/);
});
