/**
 * @lafiya/protocol — JSON Schema definitions
 *
 * Re-exports the canonical JSON Schemas from the contracts/ directory as
 * typed constants. Consumers can use these for runtime validation without
 * importing the full contracts directory.
 */

import type { BloodGroup, Genotype } from "./types.js";

// ── Record canonicalization schema ─────────────────────────────────────────────

export const RECORD_CANONICALIZATION_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "EmergencyRecordCanonical",
  description:
    "The canonical JSON representation of an emergency health record commitment input. All fields are normalized before this structure is produced.",
  type: "object",
  required: [
    "schemaVersion",
    "name",
    "bloodGroup",
    "genotype",
    "allergies",
    "medications",
    "chronicConditions",
    "emergencyContacts",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    name: { type: "string", minLength: 1 },
    bloodGroup: {
      type: "string",
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"],
    },
    genotype: {
      type: "string",
      enum: ["AA", "AS", "SS", "SC", "AC", "unknown"],
    },
    allergies: { type: "array", items: { type: "string" } },
    medications: { type: "array", items: { type: "string" } },
    chronicConditions: { type: "array", items: { type: "string" } },
    emergencyContacts: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["name", "phone", "relationship"],
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          relationship: { type: "string" },
        },
      },
    },
    language: { type: ["string", "null"] },
  },
} as const;

// ── Blood group / genotype value sets ─────────────────────────────────────────

export const BLOOD_GROUP_VALUES: readonly BloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "unknown",
] as const;

export const GENOTYPE_VALUES: readonly Genotype[] = [
  "AA",
  "AS",
  "SS",
  "SC",
  "AC",
  "unknown",
] as const;

// ── CHW attestation protocol schema ───────────────────────────────────────────

export const CHW_ATTESTATION_PROTOCOL_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "CHWAttestationProtocol",
  description: "Schema for CHW attestation protocol intents and events",
  definitions: {
    intent: {
      type: "object",
      required: [
        "intent_id",
        "record_commitment",
        "attester",
        "network_passphrase_hash",
        "contract_id",
        "schema_version",
        "idempotency_key",
      ],
      additionalProperties: false,
      properties: {
        intent_id: { type: "string" },
        record_commitment: {
          type: "string",
          pattern: "^[0-9a-f]{64}$",
          description: "HMAC-SHA256 hex commitment — never log or expose in URLs",
        },
        attester: { type: "string" },
        network_passphrase_hash: { type: "string" },
        contract_id: { type: "string" },
        schema_version: { type: "integer" },
        idempotency_key: { type: "string" },
      },
    },
    attestation_finalized_event: {
      type: "object",
      required: [
        "event_id",
        "intent_id",
        "transaction_hash",
        "ledger_sequence",
        "ledger_hash",
        "event_index",
        "record_commitment",
        "attester",
        "network_passphrase_hash",
        "contract_id",
        "contract_version",
        "schema_version",
        "idempotency_key",
      ],
    },
  },
} as const;
