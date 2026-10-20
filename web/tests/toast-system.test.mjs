import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Mock sonner module
const sonnerCalls = [];
const mockSonnerToast = {
  success: (msg, opts) => { sonnerCalls.push({ type: "success", msg, opts }); return "s1"; },
  error: (msg, opts) => { sonnerCalls.push({ type: "error", msg, opts }); return "e1"; },
  warning: (msg, opts) => { sonnerCalls.push({ type: "warning", msg, opts }); return "w1"; },
  info: (msg, opts) => { sonnerCalls.push({ type: "info", msg, opts }); return "i1"; },
  loading: (msg, opts) => { sonnerCalls.push({ type: "loading", msg, opts }); return "l1"; },
  dismiss: (id) => { sonnerCalls.push({ type: "dismiss", id }); },
  promise: (p, msgs) => { sonnerCalls.push({ type: "promise", msgs }); return p; },
};

const mod = { exports: {} };
const source = ts.transpileModule(readFileSync(new URL("../lib/toast.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

class MockApiError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

class MockNetworkError extends Error {
  constructor(message = "The network request did not complete.") {
    super(message);
    this.name = "NetworkError";
  }
}

vm.runInNewContext(source, {
  module: mod,
  exports: mod.exports,
  Date,
  setTimeout,
  clearTimeout,
  Error,
  TypeError,
  require: (name) => {
    if (name === "sonner") return { toast: mockSonnerToast };
    if (name === "./orderfit-api" || name === "@/lib/orderfit-api") {
      return { ApiError: MockApiError, NetworkError: MockNetworkError };
    }
    throw new Error(`Unexpected require: ${name}`);
  }
});

const { toast, normalizeErrorMessage } = mod.exports;

test("normalizeErrorMessage sanitizes dangerous internal errors and formats safely", () => {
  // SQL/Database errors return safe fallback
  const sqlError = new Error("SELECT * FROM users WHERE password_hash = '123' - connection lost");
  assert.equal(normalizeErrorMessage(sqlError).message, "Something went wrong. Please try again.");

  // Stack traces return safe fallback
  const traceError = new Error("Unhandled crash\nat /app/backend/internal/secret.py:42:10\nat Object.run");
  assert.equal(normalizeErrorMessage(traceError).message, "Something went wrong. Please try again.");

  // Network / fetch errors
  assert.equal(normalizeErrorMessage(new TypeError("fetch failed")).message, "Network connection issue.");
  assert.equal(normalizeErrorMessage(new Error("Failed to fetch")).message, "Network connection issue.");

  // Normal safe errors
  assert.equal(normalizeErrorMessage(new Error("Invalid email or password.")).message, "Invalid email or password.");
  assert.equal(normalizeErrorMessage("Order created successfully.").message, "Order created successfully.");

  // Unknown objects
  assert.equal(normalizeErrorMessage(null).message, "Something went wrong. Please try again.");
  assert.equal(normalizeErrorMessage(undefined).message, "Something went wrong. Please try again.");
});

test("toast methods trigger sonner with correct defaults and options", () => {
  sonnerCalls.length = 0;

  toast.success("Profile updated successfully.");
  assert.equal(sonnerCalls.length, 1);
  assert.equal(sonnerCalls[0].type, "success");
  assert.equal(sonnerCalls[0].msg, "Profile updated successfully.");
  assert.equal(sonnerCalls[0].opts.duration, 3000);

  toast.error("Invalid email or password.");
  assert.equal(sonnerCalls.length, 2);
  assert.equal(sonnerCalls[1].type, "error");
  assert.equal(sonnerCalls[1].msg, "Invalid email or password.");
  assert.equal(sonnerCalls[1].opts.duration, 5000);

  toast.warning("You have unsaved changes.");
  assert.equal(sonnerCalls.length, 3);
  assert.equal(sonnerCalls[2].type, "warning");
  assert.equal(sonnerCalls[2].opts.duration, 4500);

  toast.info("Your export is being prepared.");
  assert.equal(sonnerCalls.length, 4);
  assert.equal(sonnerCalls[3].type, "info");
  assert.equal(sonnerCalls[3].opts.duration, 3500);
});

test("toast deduplication prevents spam within the deduplication window", () => {
  sonnerCalls.length = 0;

  // Immediate duplicates of the same message and type
  toast.success("Operation succeeded.");
  toast.success("Operation succeeded.");
  toast.success("Operation succeeded.");

  assert.equal(sonnerCalls.length, 1, "Only first toast should fire within deduplication window");

  // Different message should fire
  toast.success("Another action succeeded.");
  assert.equal(sonnerCalls.length, 2);

  // Different type with same message should fire
  toast.error("Operation succeeded.");
  assert.equal(sonnerCalls.length, 3);
});

test("toast.fromError formats and displays sanitized error notification", () => {
  sonnerCalls.length = 0;

  const err = new Error("Custom permission denied");
  toast.fromError(err, "Fallback error message");

  assert.equal(sonnerCalls.length, 1);
  assert.equal(sonnerCalls[0].type, "error");
  assert.equal(sonnerCalls[0].msg, "Custom permission denied");
});
