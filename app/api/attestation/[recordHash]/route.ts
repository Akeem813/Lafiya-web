import { NextResponse } from "next/server";

import { getAttestation } from "@/lib/stellar/attestation";
import { checkRateLimit, getClientIp, recordFailure } from "@/lib/rate-limit";
import {
  SANDBOX_HEADER,
  buildSandboxWebhook,
  checkSandboxRateLimit,
  getSandboxFixture,
  resolveSandboxAuth,
} from "@/lib/sandbox";

import { logError, logInfo } from "@/lib/logging/logger";

const RECORD_HASH_PATTERN = /^[0-9a-f]{64}$/i;
const ROUTE_CLASS = "attestation_lookup";

type AttestationLookupOutcome =
  "invalid_request" | "rate_limited" | "verified" | "not_found" | "error";

function latencyBucket(elapsedMs: number): string {
  if (elapsedMs < 100) return "under_100_ms";
  if (elapsedMs < 500) return "100_to_499_ms";
  if (elapsedMs < 2_000) return "500_to_1999_ms";
  return "2000_ms_or_more";
}

function lookupContext(outcome: AttestationLookupOutcome, startedAt: number) {
  return {
    routeClass: ROUTE_CLASS,
    outcome,
    latencyBucket: latencyBucket(Math.max(0, Date.now() - startedAt)),
  };
}

function logLookupCompleted(
  outcome: Exclude<AttestationLookupOutcome, "error">,
  startedAt: number,
) {
  logInfo("Attestation lookup completed", lookupContext(outcome, startedAt));
}

/**
 * Read-only, unauthenticated lookup of an attestation by record hash. A
 * distinct Route Handler (rather than folded into the card page's Server
 * Component) because this is meant to be callable by things that aren't
 * this app's own pages — client-side polling, or lafiya-verifier later —
 * per README.md > Repository Structure.
 *
 * --- Rate limiting (issue-03) ---
 * The *primary* defense against enumerating record hashes is the
 * commitment scheme itself: record_hash is now HMAC-keyed by a per-patient
 * 256-bit secret (lib/attestation/recordHash.ts), so brute-forcing a valid
 * hash is computationally infeasible regardless of request rate. The
 * per-instance limiter below is defense-in-depth on top of that, not the
 * primary control — a fully distributed, atomicity-correct rate limiter is
 * separately tracked in issues/issue-07-distributed-rate-limiting.md
 * (which explicitly scopes this route out of its own work); duplicating
 * that effort here would be out of scope for this issue.
 *
 * Keyed by IP only: there's no user/email identity on this route, and
 * keying by the guessed hash itself would let an attacker evade the limit
 * trivially by varying the hash every request. recordFailure is called on
 * every request (not just misses) — a single lucky guess must not reset an
 * attacker's counter the way a correct password does on sign-in.
 *
 * --- Ledger pinning (issue-561) ---
 * getAttestation returns a LedgerPinnedResult so the observed Soroban
 * ledger (and the RPC host that served it) is surfaced to consumers,
 * letting them reason about freshness and cross-check against indexers.
 *
 * --- Partner sandbox (issue-786) ---
 * A sandbox bearer key short-circuits to synthetic fixtures (lib/sandbox)
 * before any production dependency is touched, with its own rate limit.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ recordHash: string }> },
) {
  const startedAt = Date.now();
  const { recordHash } = await params;

  if (!RECORD_HASH_PATTERN.test(recordHash)) {
    logLookupCompleted("invalid_request", startedAt);
    return NextResponse.json(
      { error: "recordHash must be a 64-character hex SHA-256 digest" },
      { status: 400 },
    );
  }

  const sandbox = resolveSandboxAuth(request);
  if (sandbox.mode === "invalid") {
    return NextResponse.json({ error: "Invalid sandbox API key" }, { status: 401 });
  }
  if (sandbox.mode === "sandbox") {
    const sandboxHeaders = { [SANDBOX_HEADER]: "true" };
    const limit = checkSandboxRateLimit(sandbox.keyId);
    if (!limit.allowed) {
      return NextResponse.json(
        { sandbox: true, error: "Too many requests. Please try again later.", secondsRemaining: limit.secondsRemaining },
        { status: 429, headers: sandboxHeaders },
      );
    }
    const fixture = getSandboxFixture(recordHash);
    return NextResponse.json(
      {
        sandbox: true,
        verified: fixture?.verified ?? false,
        state: fixture?.state ?? null,
        attestation: fixture?.attestation ?? null,
        ledger: null,
        rpcHost: null,
        simulatedWebhook: buildSandboxWebhook(recordHash),
      },
      { headers: sandboxHeaders },
    );
  }

  try {
    const ip = await getClientIp();
    const rateLimitKey = `attestation-lookup:${ip}`;

    const limitCheck = await checkRateLimit(rateLimitKey);
    if (!limitCheck.allowed) {
      logLookupCompleted("rate_limited", startedAt);
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          secondsRemaining: limitCheck.secondsRemaining,
        },
        { status: 429 },
      );
    }

    await recordFailure(rateLimitKey);

    const pinned = await getAttestation(recordHash);
    const attestation = pinned?.value ?? null;
    logLookupCompleted(
      attestation === null ? "not_found" : "verified",
      startedAt,
    );
    return NextResponse.json({
      verified: attestation !== null,
      attestation,
      ledger: pinned?.ledger ?? null,
      rpcHost: pinned?.rpcHost ?? null,
    });
  } catch {
    logError(
      "Attestation lookup failed",
      new Error("ATTESTATION_LOOKUP_FAILED"),
      lookupContext("error", startedAt),
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
