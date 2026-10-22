#!/usr/bin/env node
/**
 * scripts/compute-error-budget.mjs
 *
 * Computes the rolling error budget for the public-card availability SLO
 * from a synthetic probe results file and/or request metrics, then applies
 * multi-window burn-rate thresholds to emit an actionable budget report.
 *
 * Usage:
 *   node scripts/compute-error-budget.mjs [--probes <path>] [--output <path>]
 *
 * Inputs (all optional; defaults work for CI fixtures):
 *   --probes <path>   JSON array of probe results (see schema below)
 *   --output <path>   Write budget report JSON to this path (default: stdout)
 *   --fixture         Use built-in fixture data (for unit tests)
 *
 * Probe result schema:
 *   [
 *     {
 *       "timestamp": "2026-10-22T12:00:00Z",  // ISO-8601
 *       "success": true,                        // true = card resolved correctly
 *       "latencyMs": 320                        // optional, used for p95 SLO
 *     }, ...
 *   ]
 *
 * Output schema (budget report):
 *   {
 *     "schemaVersion": 1,
 *     "generatedAt": "...",
 *     "slo": { "target": 0.999, "windowHours": 720 },
 *     "windows": {
 *       "1h":  { "totalProbes": N, "errors": N, "errorRate": 0.0, "burnRate": 0.0 },
 *       "6h":  { ... },
 *       "24h": { ... },
 *       "72h": { ... },
 *       "720h": { ... }
 *     },
 *     "budget": {
 *       "allowedErrorRate": 0.001,
 *       "consumedFraction": 0.42,
 *       "remainingFraction": 0.58,
 *       "exhausted": false
 *     },
 *     "alert": {
 *       "severity": "none" | "warn" | "page",
 *       "reason": "...",
 *       "burnRateThresholds": { ... }
 *     },
 *     "gate": {
 *       "pass": true,
 *       "reason": "..."
 *     }
 *   }
 *
 * Exit codes:
 *   0  Budget healthy or warn-only — gate passes.
 *   1  Budget exhausted — gate blocks non-fix releases.
 *   2  Invalid input / unexpected error.
 */

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const SLO_TARGET = 0.999; // 99.9% public-card availability
const WINDOW_HOURS = 720; // 30-day rolling window
const ALLOWED_ERROR_RATE = 1 - SLO_TARGET; // 0.001

/**
 * Multi-window burn-rate thresholds (Google SRE Chapter 5 style).
 *
 * A burn rate of N means the budget is being consumed N× faster than the
 * allowed rate. Each window uses a short+long pair: the short window catches
 * fast burns early; the long window confirms sustained burns.
 *
 * Thresholds:
 *   - severity=page:  1h burn ≥ 14.4 (1% budget in 1h) or 6h burn ≥ 6 (5% in 5h)
 *   - severity=warn:  24h burn ≥ 3 (10% budget in 1 day) or 72h burn ≥ 1 (exhaustion in 30d)
 */
const BURN_RATE_THRESHOLDS = {
  page: [
    { shortWindowHours: 1, longWindowHours: 6, burnRateThreshold: 14.4 },
    { shortWindowHours: 6, longWindowHours: 6, burnRateThreshold: 6.0 },
  ],
  warn: [
    { shortWindowHours: 24, longWindowHours: 24, burnRateThreshold: 3.0 },
    { shortWindowHours: 72, longWindowHours: 72, burnRateThreshold: 1.0 },
  ],
};

/**
 * Built-in fixtures for unit testing with --fixture flag.
 * Three scenarios: healthy, burning fast, exhausted.
 */
export const FIXTURES = {
  healthy: generateProbes({ durationHours: 720, errorEvery: 5000 }),
  burning_fast: generateProbes({ durationHours: 24, errorEvery: 20 }),
  exhausted: generateProbes({ durationHours: 720, errorEvery: 100 }),
};

function generateProbes({ durationHours, errorEvery }) {
  const probes = [];
  const now = Date.now();
  const count = durationHours * 12; // one probe every 5 minutes
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(
      now - (count - i) * 5 * 60 * 1000,
    ).toISOString();
    probes.push({
      timestamp,
      success: i % errorEvery !== 0,
      latencyMs: 200 + Math.floor(Math.random() * 300),
    });
  }
  return probes;
}

/**
 * Filter probes to those within the last `windowHours` hours.
 */
function probesInWindow(probes, windowHours, now = Date.now()) {
  const cutoff = now - windowHours * 60 * 60 * 1000;
  return probes.filter((p) => Date.parse(p.timestamp) >= cutoff);
}

/**
 * Compute error rate for a set of probes.
 */
function errorRate(probes) {
  if (probes.length === 0) return 0;
  const errors = probes.filter((p) => !p.success).length;
  return errors / probes.length;
}

/**
 * Compute burn rate: actual error rate / allowed error rate.
 * A burn rate of 1.0 means we're spending budget at exactly the SLO rate.
 */
function burnRate(probes) {
  return errorRate(probes) / ALLOWED_ERROR_RATE;
}

/**
 * Core computation. Accepts a probe array; returns the full budget report.
 *
 * @param {Array<{timestamp: string, success: boolean, latencyMs?: number}>} probes
 * @returns {object} Budget report (see output schema above)
 */
export function computeBudget(probes) {
  const now = Date.now();
  const windowNames = ["1h", "6h", "24h", "72h", "720h"];
  const windowMap = { "1h": 1, "6h": 6, "24h": 24, "72h": 72, "720h": 720 };

  const windows = {};
  for (const name of windowNames) {
    const hrs = windowMap[name];
    const subset = probesInWindow(probes, hrs, now);
    const errors = subset.filter((p) => !p.success).length;
    const rate = errorRate(subset);
    const burn = burnRate(subset);
    windows[name] = {
      totalProbes: subset.length,
      errors,
      errorRate: round(rate, 6),
      burnRate: round(burn, 3),
    };
  }

  // Compute remaining budget using the full 720h window
  const full = probesInWindow(probes, WINDOW_HOURS, now);
  const consumed = errorRate(full);
  const consumedFraction = consumed / ALLOWED_ERROR_RATE;
  const remainingFraction = Math.max(0, 1 - consumedFraction);
  const exhausted = remainingFraction <= 0;

  // Determine alert severity from multi-window burn-rate thresholds
  let alertSeverity = "none";
  let alertReason = "All burn rates within thresholds.";

  for (const [severity, checks] of Object.entries(BURN_RATE_THRESHOLDS)) {
    for (const check of checks) {
      const shortName = `${check.shortWindowHours}h`;
      const shortBurn = windows[shortName]?.burnRate ?? 0;
      if (shortBurn >= check.burnRateThreshold) {
        if (severity === "page" || alertSeverity !== "page") {
          alertSeverity = severity;
          alertReason =
            `${shortName} burn rate ${shortBurn} ≥ threshold ${check.burnRateThreshold}` +
            ` (${severity === "page" ? "immediate response required" : "review required"}).`;
        }
      }
    }
  }

  // Gate: block non-fix releases when budget is exhausted or severity=page
  const gatePass = !exhausted && alertSeverity !== "page";
  const gateReason = exhausted
    ? "Error budget exhausted. Only bug fixes may be deployed. Use override with documented reason."
    : alertSeverity === "page"
      ? "High burn rate detected. Gate blocked to protect remaining budget."
      : "Budget healthy. Release gate passes.";

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    slo: { target: SLO_TARGET, windowHours: WINDOW_HOURS },
    windows,
    budget: {
      allowedErrorRate: ALLOWED_ERROR_RATE,
      consumedFraction: round(consumedFraction, 4),
      remainingFraction: round(remainingFraction, 4),
      exhausted,
    },
    alert: {
      severity: alertSeverity,
      reason: alertReason,
      burnRateThresholds: BURN_RATE_THRESHOLDS,
    },
    gate: {
      pass: gatePass,
      reason: gateReason,
    },
  };
}

function round(value, decimals) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

// ── CLI entry point ───────────────────────────────────────────────────────────
// Only runs when invoked directly; not when imported as a module for testing.
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("compute-error-budget.mjs") ||
    process.argv[1] === new URL(import.meta.url).pathname);

if (isMain) {
  main();
}

function main() {
  const probesPath = argValue(args, "--probes");
  const outputPath = argValue(args, "--output");
  const useFixture = args.includes("--fixture");
  const fixtureScenario = argValue(args, "--scenario") ?? "healthy";

  let probes;

  if (useFixture) {
    if (!Object.prototype.hasOwnProperty.call(FIXTURES, fixtureScenario)) {
      console.error(
        `Unknown fixture scenario '${fixtureScenario}'. Available: ${Object.keys(FIXTURES).join(", ")}`,
      );
      process.exit(2);
    }
    probes = FIXTURES[fixtureScenario];
    console.error(`[error-budget] Using fixture scenario: ${fixtureScenario}`);
  } else if (probesPath) {
    try {
      const raw = readFileSync(resolve(probesPath), "utf8");
      probes = JSON.parse(raw);
      if (!Array.isArray(probes)) throw new Error("Probes must be a JSON array");
    } catch (err) {
      console.error(`[error-budget] Failed to load probes from ${probesPath}: ${err.message}`);
      process.exit(2);
    }
  } else {
    console.error("[error-budget] No probe data provided. Use --probes <path> or --fixture.");
    process.exit(2);
  }

  const report = computeBudget(probes);

  const json = JSON.stringify(report, null, 2);
  if (outputPath) {
    writeFileSync(resolve(outputPath), json, "utf8");
    console.error(`[error-budget] Report written to ${outputPath}`);
  } else {
    process.stdout.write(json + "\n");
  }

  // Surface remaining budget as a GitHub Actions step summary annotation
  if (process.env.GITHUB_STEP_SUMMARY) {
    const pct = (report.budget.remainingFraction * 100).toFixed(1);
    const icon = report.gate.pass ? "✅" : "🚨";
    const summary = [
      `## ${icon} Error Budget Report`,
      "",
      `| Metric | Value |`,
      `|---|---|`,
      `| SLO target | ${(report.slo.target * 100).toFixed(1)}% |`,
      `| Budget remaining | **${pct}%** |`,
      `| Alert severity | ${report.alert.severity} |`,
      `| Gate | ${report.gate.pass ? "PASS" : "BLOCKED"} |`,
      "",
      `**1h burn rate:** ${report.windows["1h"].burnRate}x  `,
      `**6h burn rate:** ${report.windows["6h"].burnRate}x  `,
      `**24h burn rate:** ${report.windows["24h"].burnRate}x  `,
      "",
      `_${report.gate.reason}_`,
    ].join("\n");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }

  // Exit 1 when gate is blocked so that CI fails the release step
  if (!report.gate.pass) {
    console.error(`[error-budget] GATE BLOCKED: ${report.gate.reason}`);
    process.exit(1);
  }

  console.error(`[error-budget] GATE PASS: ${report.gate.reason}`);
  process.exit(0);
}

function argValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
