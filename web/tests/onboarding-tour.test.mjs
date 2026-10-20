import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Transpile tour-steps.ts
const stepsMod = { exports: {} };
const stepsSource = ts.transpileModule(
  readFileSync(new URL("../components/onboarding/tour-steps.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

vm.runInNewContext(stepsSource, {
  module: stepsMod,
  exports: stepsMod.exports,
  require: () => ({}),
});
const { ONBOARDING_STEPS } = stepsMod.exports;

// Transpile onboarding-storage.ts with mock localStorage
const storageMod = { exports: {} };
const storageSource = ts.transpileModule(
  readFileSync(new URL("../components/onboarding/onboarding-storage.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

const mockStorageMap = new Map();
const mockLocalStorage = {
  getItem: (k) => mockStorageMap.get(k) ?? null,
  setItem: (k, v) => mockStorageMap.set(k, String(v)),
  removeItem: (k) => mockStorageMap.delete(k),
  clear: () => mockStorageMap.clear(),
};

vm.runInNewContext(storageSource, {
  module: storageMod,
  exports: storageMod.exports,
  window: {},
  localStorage: mockLocalStorage,
  Date,
  JSON,
  require: () => ({}),
});
const { getStorageKey, loadTourRecord, saveTourRecord, resetTourRecord } = storageMod.exports;

test("ONBOARDING_STEPS defines 8 concrete steps covering Overview and Deals / New", () => {
  assert.equal(ONBOARDING_STEPS.length, 8, "Tour should consist of exactly 8 concise steps");

  // Step 1: Welcome on Overview
  const step1 = ONBOARDING_STEPS[0];
  assert.equal(step1.id, "welcome");
  assert.equal(step1.route, "/overview");
  assert.equal(step1.selector, null);
  assert.equal(step1.nextLabel, "Start Tour");

  // Step 2: Overview KPIs
  const step2 = ONBOARDING_STEPS[1];
  assert.equal(step2.id, "overview-kpis");
  assert.equal(step2.route, "/overview");
  assert.equal(step2.selector, '[data-tour="overview-kpis"]');

  // Step 3: Sidebar nav
  const step3 = ONBOARDING_STEPS[2];
  assert.equal(step3.id, "sidebar-nav");
  assert.equal(step3.route, "/overview");
  assert.equal(step3.selector, '[data-tour="sidebar-nav"]');

  // Step 4: Cashflow timeline
  const step4 = ONBOARDING_STEPS[3];
  assert.equal(step4.id, "overview-cashflow");
  assert.equal(step4.route, "/overview");
  assert.equal(step4.selector, '[data-tour="overview-cashflow"]');

  // Step 5: Transition to Deals
  const step5 = ONBOARDING_STEPS[4];
  assert.equal(step5.id, "explore-deals");
  assert.equal(step5.route, "/overview");
  assert.equal(step5.selector, '[data-tour="explore-deals-btn"]');
  assert.equal(step5.isNavigationStep, true);

  // Step 6: Deals New Header
  const step6 = ONBOARDING_STEPS[5];
  assert.equal(step6.id, "deals-new-header");
  assert.equal(step6.route, "/deals/new");
  assert.equal(step6.selector, '[data-tour="deals-new-header"]');

  // Step 7: Deals New Terms
  const step7 = ONBOARDING_STEPS[6];
  assert.equal(step7.id, "deals-new-terms");
  assert.equal(step7.route, "/deals/new");
  assert.equal(step7.selector, '[data-tour="deals-new-terms"]');

  // Step 8: Completion
  const step8 = ONBOARDING_STEPS[7];
  assert.equal(step8.id, "completion");
  assert.equal(step8.route, "/deals/new");
  assert.equal(step8.selector, null);
  assert.equal(step8.nextLabel, "Get Started");

  // All steps have non-empty title and description
  for (const s of ONBOARDING_STEPS) {
    assert.ok(s.title && s.title.trim().length > 0, `Step ${s.id} missing title`);
    assert.ok(s.description && s.description.trim().length > 0, `Step ${s.id} missing description`);
  }
});

test("Storage keys are strictly scoped per authenticated user", () => {
  const keyA = getStorageKey("user-123");
  const keyB = getStorageKey("user-456");
  const keyGuest = getStorageKey("");

  assert.equal(keyA, "orderfit_onboarding_v1_user-123");
  assert.equal(keyB, "orderfit_onboarding_v1_user-456");
  assert.equal(keyGuest, "orderfit_onboarding_v1_anonymous");
  assert.notEqual(keyA, keyB);
});

test("Skipping tour permanently dismisses it for the current user without affecting other users", () => {
  mockStorageMap.clear();

  // User 1 starts tour and skips on step 2
  saveTourRecord("user-1", { status: "in_progress", currentStepIndex: 2 });
  const skippedRec1 = saveTourRecord("user-1", { status: "skipped" });

  assert.equal(skippedRec1.status, "skipped");
  assert.ok(skippedRec1.skippedAt);

  // User 2 has not started yet
  const user2Rec = loadTourRecord("user-2");
  assert.equal(user2Rec, null);

  // User 2 starts and completes tour
  saveTourRecord("user-2", { status: "in_progress", currentStepIndex: 0 });
  const completedRec2 = saveTourRecord("user-2", { status: "completed", currentStepIndex: 7 });

  assert.equal(completedRec2.status, "completed");
  assert.ok(completedRec2.completedAt);

  // Verify User 1 remains skipped and User 2 remains completed
  assert.equal(loadTourRecord("user-1").status, "skipped");
  assert.equal(loadTourRecord("user-2").status, "completed");
});

test("Replay tour resets user record to in_progress at step 0", () => {
  mockStorageMap.clear();

  saveTourRecord("user-1", { status: "completed", currentStepIndex: 7 });
  assert.equal(loadTourRecord("user-1").status, "completed");

  const resetRec = resetTourRecord("user-1");
  assert.equal(resetRec.status, "in_progress");
  assert.equal(resetRec.currentStepIndex, 0);

  const reloaded = loadTourRecord("user-1");
  assert.equal(reloaded.status, "in_progress");
  assert.equal(reloaded.currentStepIndex, 0);
});
