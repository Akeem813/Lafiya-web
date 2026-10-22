#!/usr/bin/env node
/**
 * scripts/record-budget-override.mjs
 *
 * Records an explicit, audited override when deploying while the error
 * budget is exhausted or the release gate would otherwise block.
 *
 * An override requires:
 *   1. A non-empty reason describing why the deployment is safe.
 *   2. The actor identity (GitHub login or display name).
 *   3. Acknowledgement that this is a fix or urgent change (--fix or --urgent).
 *
 * The override record is written to release-evidence/budget-overrides.jsonl
 * (one JSON object per line) so that the full history can be audited.
 *
 * Usage:
 *   node scripts/record-budget-override.mjs \
 *     --reason "Critical auth regression fix — only auth route affected" \
 *     --actor "github_actor_login" \
 *     --type  "fix"
 *
 * Options:
 *   --reason <text>    Required. Why this deployment is safe despite budget state.
 *   --actor  <name>    Required. GitHub login or display name of the approver.
 *   --type   <kind>    Required. One of: fix, urgent, rollback.
 *   --output <path>    Optional. Append-only JSONL file (default: release-evidence/budget-overrides.jsonl).
 *   --dry-run          Print the record without writing it.
 *
 * Exit codes:
 *   0  Override recorded successfully.
 *   1  Missing required argument.
 *   2  Invalid --type value.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = resolve(__dirname, "..", "release-evidence", "budget-overrides.jsonl");

const VALID_TYPES = ["fix", "urgent", "rollback"];

function argValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2);
  const reason = argValue(args, "--reason");
  const actor = argValue(args, "--actor");
  const type = argValue(args, "--type");
  const outputPath = argValue(args, "--output") ?? DEFAULT_OUTPUT;
  const dryRun = args.includes("--dry-run");

  const errors = [];
  if (!reason || !reason.trim()) errors.push("--reason is required and must not be empty");
  if (!actor || !actor.trim()) errors.push("--actor is required and must not be empty");
  if (!type) errors.push("--type is required");
  else if (!VALID_TYPES.includes(type)) {
    errors.push(`--type must be one of: ${VALID_TYPES.join(", ")} (got '${type}')`);
  }

  if (errors.length) {
    for (const e of errors) console.error(`Error: ${e}`);
    console.error(
      `\nUsage: node scripts/record-budget-override.mjs --reason <text> --actor <name> --type <fix|urgent|rollback>`,
    );
    process.exit(errors.some((e) => e.includes("--type must be")) ? 2 : 1);
  }

  const record = {
    timestamp: new Date().toISOString(),
    actor: actor.trim(),
    type,
    reason: reason.trim(),
    environment: process.env.LAFIYA_DEPLOYMENT_ENV ?? "unknown",
    buildRevision: process.env.GITHUB_SHA ?? "unknown",
    runId: process.env.GITHUB_RUN_ID ?? "unknown",
    workflow: process.env.GITHUB_WORKFLOW ?? "unknown",
  };

  const line = JSON.stringify(record);

  if (dryRun) {
    console.log("[dry-run] Would append to", outputPath);
    console.log(line);
    process.exit(0);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  appendFileSync(outputPath, line + "\n", "utf8");

  console.log(`[budget-override] Override recorded by ${record.actor} (${record.type})`);
  console.log(`[budget-override] Reason: ${record.reason}`);
  console.log(`[budget-override] Written to: ${outputPath}`);
}

main();
