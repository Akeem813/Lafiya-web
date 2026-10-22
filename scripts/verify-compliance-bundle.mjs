#!/usr/bin/env node
/**
 * scripts/verify-compliance-bundle.mjs
 *
 * Verifies a compliance evidence bundle produced by collect-compliance-evidence.mjs:
 *   1. Checks bundle structure (schemaVersion, required fields, controls array).
 *   2. Verifies the HMAC-SHA256 signature if a signing key is provided.
 *   3. Confirms completeness: at least 10 controls, all required control IDs present.
 *   4. Scans the entire bundle for PHI patterns (exits 1 on detection).
 *   5. Reports pass/fail per control and overall outcome.
 *
 * Usage:
 *   node scripts/verify-compliance-bundle.mjs <bundle.json> [<bundle.sig>]
 *
 * Environment:
 *   COMPLIANCE_EVIDENCE_SIGNING_KEY  — required if a .sig file is provided
 *
 * Exit codes:
 *   0  Bundle is valid, complete, and PHI-free.
 *   1  Validation failure (signature mismatch, missing controls, PHI detected).
 *   2  Usage error or file not found.
 */

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_CONTROL_IDS = [
  "CI-001",
  "CI-002",
  "CI-003",
  "CI-004",
  "CI-005",
  "CI-006",
  "CI-007",
  "SEC-001",
  "SEC-002",
  "SEC-003",
];

const MIN_CONTROLS = 10;

const PHI_PATTERNS = [
  /\+234\d{10}/,
  /\b0[7-9][01]\d{8}\b/,
  /"blood_group"\s*:\s*"(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)"(?!\s*(unknown|null))/,
  /"genotype"\s*:\s*"(AA|AS|SS|SC|AC)"(?!\s*(unknown|null))/,
  /eyJ[A-Za-z0-9+/]{100,}/,
];

function containsPhi(text) {
  return PHI_PATTERNS.some((pattern) => pattern.test(text));
}

function main() {
  const bundlePath = process.argv[2];
  const sigPath = process.argv[3];

  if (!bundlePath) {
    console.error(
      "Usage: node scripts/verify-compliance-bundle.mjs <bundle.json> [<bundle.sig>]",
    );
    process.exit(2);
  }

  if (!existsSync(resolve(bundlePath))) {
    console.error(`Bundle file not found: ${bundlePath}`);
    process.exit(2);
  }

  const bundleRaw = readFileSync(resolve(bundlePath), "utf8");
  let bundle;
  try {
    bundle = JSON.parse(bundleRaw);
  } catch {
    console.error("Bundle is not valid JSON.");
    process.exit(1);
  }

  const errors = [];

  // ── PHI scan ────────────────────────────────────────────────────────────────
  if (containsPhi(bundleRaw)) {
    errors.push("PHI detected in bundle content — bundle must be re-generated without PHI");
  }

  // ── Signature verification ──────────────────────────────────────────────────
  if (sigPath) {
    const signingKey = process.env.COMPLIANCE_EVIDENCE_SIGNING_KEY;
    if (!signingKey) {
      errors.push(
        "Signature file provided but COMPLIANCE_EVIDENCE_SIGNING_KEY is not set",
      );
    } else {
      if (!existsSync(resolve(sigPath))) {
        errors.push(`Signature file not found: ${sigPath}`);
      } else {
        const expectedSig = createHmac("sha256", signingKey)
          .update(bundleRaw)
          .digest("hex");
        const actualSig = readFileSync(resolve(sigPath), "utf8").trim();
        if (expectedSig !== actualSig) {
          errors.push("Signature mismatch — bundle may have been tampered with");
        } else {
          console.log("✓ Signature verified");
        }
      }
    }
  }

  // ── Schema check ────────────────────────────────────────────────────────────
  if (bundle.schemaVersion !== 1) {
    errors.push(`Unexpected schemaVersion: ${bundle.schemaVersion} (expected 1)`);
  }
  for (const field of [
    "period",
    "generatedAt",
    "buildRevision",
    "controls",
    "summary",
  ]) {
    if (!(field in bundle)) errors.push(`Missing required field: ${field}`);
  }

  // ── Completeness check ──────────────────────────────────────────────────────
  if (!Array.isArray(bundle.controls)) {
    errors.push("controls must be an array");
  } else {
    if (bundle.controls.length < MIN_CONTROLS) {
      errors.push(
        `Insufficient controls: ${bundle.controls.length} collected, minimum ${MIN_CONTROLS} required`,
      );
    }

    const presentIds = new Set(bundle.controls.map((c) => c.id));
    for (const id of REQUIRED_CONTROL_IDS) {
      if (!presentIds.has(id)) {
        errors.push(`Required control missing from bundle: ${id}`);
      }
    }

    // Report per-control status
    const failed = bundle.controls.filter((c) => c.status === "fail");
    if (failed.length > 0) {
      console.warn(`\n⚠ ${failed.length} control(s) have status=fail:`);
      for (const c of failed) {
        console.warn(`  ${c.id} — ${c.name}: ${c.reason ?? "no reason"}`);
      }
    } else {
      console.log(`✓ All ${bundle.controls.length} controls present`);
    }
  }

  // ── Outcome ─────────────────────────────────────────────────────────────────
  if (errors.length === 0) {
    console.log("\n✅ Compliance bundle is valid, complete, and PHI-free.");
    console.log(
      `   Period: ${bundle.period ?? "unknown"} | Controls: ${bundle.summary?.total ?? "?"} | Signed: ${bundle.signed ? "yes" : "no"}`,
    );
    process.exit(0);
  } else {
    console.error("\n🚨 Compliance bundle verification FAILED:");
    for (const err of errors) console.error(`  ✗ ${err}`);
    process.exit(1);
  }
}

main();
