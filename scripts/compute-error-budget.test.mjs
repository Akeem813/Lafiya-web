/**
 * Unit tests for compute-error-budget.mjs
 *
 * Tests gate logic with three budget fixtures: healthy, burning fast, exhausted.
 * Run with: node --experimental-vm-modules scripts/compute-error-budget.test.mjs
 * Or via: node scripts/compute-error-budget.test.mjs
 */

// Inline minimal test runner — no external dependencies required.
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// Load the module under test
const { computeBudget, FIXTURES } = await import(
  "./compute-error-budget.mjs"
);

// ── Fixture: healthy ──────────────────────────────────────────────────────────

console.log("\nFixture: healthy (error every 5000 probes)");

test("healthy budget is not exhausted", () => {
  const report = computeBudget(FIXTURES.healthy);
  assert(!report.budget.exhausted, "Budget should not be exhausted");
});

test("healthy gate passes", () => {
  const report = computeBudget(FIXTURES.healthy);
  assert(report.gate.pass, `Gate should pass, got: ${report.gate.reason}`);
});

test("healthy alert severity is none or warn (not page)", () => {
  const report = computeBudget(FIXTURES.healthy);
  assert(
    report.alert.severity !== "page",
    `Expected no page alert, got: ${report.alert.severity}`,
  );
});

test("healthy consumed fraction is well below 1", () => {
  const report = computeBudget(FIXTURES.healthy);
  assert(
    report.budget.consumedFraction < 0.5,
    `Consumed fraction ${report.budget.consumedFraction} is too high for a healthy budget`,
  );
});

// ── Fixture: burning_fast ─────────────────────────────────────────────────────

console.log("\nFixture: burning_fast (error every 20 probes in last 24h)");

test("burning_fast budget triggers elevated severity", () => {
  const report = computeBudget(FIXTURES.burning_fast);
  assert(
    report.alert.severity !== "none",
    "Expected warn or page alert for fast burn",
  );
});

test("burning_fast 1h burn rate is high", () => {
  const report = computeBudget(FIXTURES.burning_fast);
  assert(
    report.windows["1h"].burnRate > 1,
    `Expected 1h burn rate > 1, got ${report.windows["1h"].burnRate}`,
  );
});

test("burning_fast gate blocks or warns", () => {
  const report = computeBudget(FIXTURES.burning_fast);
  // A fast burn blocks the gate (page-severity) or at minimum warns
  assert(
    !report.gate.pass || report.alert.severity === "warn",
    `Gate should block or warn for fast burn; gate.pass=${report.gate.pass}, severity=${report.alert.severity}`,
  );
});

// ── Fixture: exhausted ────────────────────────────────────────────────────────

console.log("\nFixture: exhausted (error every 100 probes over 30 days)");

test("exhausted budget is flagged as exhausted", () => {
  const report = computeBudget(FIXTURES.exhausted);
  assert(report.budget.exhausted, "Budget should be exhausted");
});

test("exhausted gate is blocked", () => {
  const report = computeBudget(FIXTURES.exhausted);
  assert(!report.gate.pass, `Gate should be blocked for exhausted budget`);
});

test("exhausted gate reason mentions override", () => {
  const report = computeBudget(FIXTURES.exhausted);
  assert(
    report.gate.reason.toLowerCase().includes("override"),
    `Gate reason should mention override process, got: ${report.gate.reason}`,
  );
});

test("exhausted remaining fraction is 0", () => {
  const report = computeBudget(FIXTURES.exhausted);
  assertEqual(
    report.budget.remainingFraction,
    0,
    `Remaining fraction should be 0 when exhausted, got ${report.budget.remainingFraction}`,
  );
});

// ── Schema structure ──────────────────────────────────────────────────────────

console.log("\nSchema structure");

test("report has required top-level keys", () => {
  const report = computeBudget(FIXTURES.healthy);
  for (const key of [
    "schemaVersion",
    "generatedAt",
    "slo",
    "windows",
    "budget",
    "alert",
    "gate",
  ]) {
    assert(key in report, `Missing key: ${key}`);
  }
});

test("report contains all required window names", () => {
  const report = computeBudget(FIXTURES.healthy);
  for (const window of ["1h", "6h", "24h", "72h", "720h"]) {
    assert(window in report.windows, `Missing window: ${window}`);
  }
});

test("report schemaVersion is 1", () => {
  const report = computeBudget(FIXTURES.healthy);
  assertEqual(report.schemaVersion, 1);
});

test("gate.pass is a boolean", () => {
  const report = computeBudget(FIXTURES.healthy);
  assertEqual(typeof report.gate.pass, "boolean");
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
