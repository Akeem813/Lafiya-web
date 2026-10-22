/**
 * @lafiya/protocol — Shared protocol types
 *
 * This module contains ONLY protocol-level types. It must never import
 * server-only modules, database clients, or secret-handling utilities.
 */

// ── Schema versioning ──────────────────────────────────────────────────────────

/**
 * Semver rules for @lafiya/protocol:
 *
 * PATCH — documentation, comments, internal refactor with no output change.
 * MINOR — new optional fields in a type, new exports, backward-compatible schema change.
 * MAJOR — any change to canonicalization output, commitment scheme, intent payload shape,
 *          or removal of an existing export. Every major version bump requires a new
 *          schemaVersion constant and updated test vectors.
 *
 * schemaVersion in canonicalized JSON is independent of the package version.
 * The current schema version is RECORD_SCHEMA_VERSION below.
 */

export const RECORD_SCHEMA_VERSION = 1 as const;
export type RecordSchemaVersion = typeof RECORD_SCHEMA_VERSION;

// ── Domain types ───────────────────────────────────────────────────────────────

export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-"
  | "unknown";

export type Genotype = "AA" | "AS" | "SS" | "SC" | "AC" | "unknown";

export type EmergencyContact = {
  name: string;
  phone: string;
  relationship: string;
};

export type EmergencyRecordData = {
  name: string;
  date_of_birth: string | null;
  photo_url: string | null;
  language: string | null;
  blood_group: BloodGroup;
  genotype: Genotype;
  allergies: string[];
  medications: string[];
  chronic_conditions: string[];
  emergency_contacts: EmergencyContact[];
};

export type DisclosureField = keyof EmergencyRecordData | "age";

export type DisclosurePolicy = {
  version: 1;
  fields: Record<DisclosureField, boolean>;
};

export const DEFAULT_DISCLOSURE_POLICY: DisclosurePolicy = {
  version: 1,
  fields: {
    name: true,
    date_of_birth: false,
    age: true,
    photo_url: true,
    language: true,
    blood_group: true,
    genotype: true,
    allergies: true,
    medications: true,
    chronic_conditions: true,
    emergency_contacts: true,
  },
};

// ── Protocol error codes ───────────────────────────────────────────────────────

export const PROTOCOL_ERROR_CODES = [
  "AUTH_REQUIRED",
  "CHW_NOT_AUTHORIZED",
  "CHW_SUSPENDED",
  "CHW_CREDENTIAL_EXPIRED",
  "REQUEST_NOT_FOUND",
  "REQUEST_NOT_CURRENT",
  "REQUEST_ALREADY_CLAIMED",
  "LEASE_EXPIRED",
  "LEASE_NOT_OWNER",
  "INTENT_EXPIRED",
  "INTENT_REPLAYED",
  "INTENT_SUPERSEDED",
  "WRONG_ADDRESS",
  "WRONG_NETWORK",
  "WRONG_CONTRACT",
  "UNSUPPORTED_EPOCH",
  "UNSUPPORTED_SCHEMA",
  "INVALID_INTENT",
  "INVALID_TRANSITION",
  "PRODUCTION_MOCK_FORBIDDEN",
  "PRODUCTION_PROTOCOL_CONFIG_INCOMPLETE",
  "INTENT_SIGNING_KEY_REQUIRED",
] as const;

export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];

export class ProtocolError extends Error {
  constructor(
    readonly code: ProtocolErrorCode,
    message = code,
  ) {
    super(message);
    this.name = "ProtocolError";
  }
}

// ── Attestation types ──────────────────────────────────────────────────────────

export type Attestation = {
  /** The record commitment hash (HMAC-SHA256 output, hex-encoded). */
  recordHash: string;
  /** Stellar address of the allowlisted health worker who attested. */
  attester: string;
  /** Unix seconds. */
  timestamp: number;
  /** Optional expiry timestamp (Unix seconds). */
  expiry?: number;
  /** Optional revocation flag. */
  revoked?: boolean;
};

// ── Intent types ───────────────────────────────────────────────────────────────

export type TrustState =
  | "unverified"
  | "submitted"
  | "confirming"
  | "verified"
  | "expired"
  | "revoked"
  | "superseded"
  | "conflicted"
  | "unavailable";

export type ProtocolEpoch = {
  id: string;
  schemaVersion: number;
  networkPassphraseHash: string;
  contractId: string;
  contractVersion: string;
  eventVersion: number;
  finalityDepth: number;
  status: "active" | "deprecated" | "retired";
};

export type AttestationIntentPayload = {
  version: 1;
  intentId: string;
  requestId: string;
  revisionId: string;
  /**
   * HMAC-backed commitment. Permitted only in this authorized, short-lived
   * intent — never log, store in plaintext, or surface in URLs.
   */
  recordCommitment: string;
  schemaVersion: number;
  chwId: string;
  stellarAddress: string;
  epoch: Pick<
    ProtocolEpoch,
    | "id"
    | "networkPassphraseHash"
    | "contractId"
    | "contractVersion"
    | "eventVersion"
  >;
  idempotencyKey: string;
  issuedAt: string;
  expiresAt: string;
};

export type SignedAttestationIntent = {
  payload: AttestationIntentPayload;
  signature: string;
};

// ── Intent state machine ───────────────────────────────────────────────────────

export type IntentState =
  | "created"
  | "observed"
  | "finalized"
  | "invalidated"
  | "quarantined"
  | "released"
  | "settled";

export type IntentCommand =
  | "create"
  | "attest-observed"
  | "finalize"
  | "invalidate"
  | "quarantine"
  | "release"
  | "settle";

export const INTENT_TERMINAL_STATES: readonly IntentState[] = [
  "settled",
  "invalidated",
  "quarantined",
];

export const INTENT_TRANSITIONS: Readonly<
  Record<IntentState, Partial<Record<IntentCommand, IntentState>>>
> = {
  created: {
    "attest-observed": "observed",
    invalidate: "invalidated",
    quarantine: "quarantined",
  },
  observed: {
    finalize: "finalized",
    invalidate: "invalidated",
    quarantine: "quarantined",
  },
  finalized: {
    settle: "settled",
    invalidate: "invalidated",
    quarantine: "quarantined",
  },
  released: {
    finalize: "finalized",
    invalidate: "invalidated",
    quarantine: "quarantined",
  },
  invalidated: {},
  quarantined: {
    release: "released",
  },
  settled: {},
};

export function isTerminalIntentState(state: IntentState): boolean {
  return INTENT_TERMINAL_STATES.includes(state);
}

export function applyIntentCommand(
  state: IntentState,
  command: IntentCommand,
): IntentState {
  if (command === "create") {
    if (state !== "created") throw new ProtocolError("INVALID_TRANSITION");
    return "created";
  }
  const next = INTENT_TRANSITIONS[state][command];
  if (!next) throw new ProtocolError("INVALID_TRANSITION");
  return next;
}
