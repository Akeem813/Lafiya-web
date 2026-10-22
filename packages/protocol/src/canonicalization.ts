/**
 * @lafiya/protocol — Record canonicalization and commitment scheme
 *
 * This module is platform-neutral: it uses Node's `node:crypto` for
 * HMAC-SHA256. Consumers running in browser contexts must use the Web Crypto
 * API equivalent (SubtleCrypto.importKey + SubtleCrypto.sign with HMAC-SHA-256).
 *
 * No server-only imports. No secret handling beyond the HMAC key parameter.
 */

import { createHmac } from "node:crypto";

import { parsePhoneNumberFromString } from "libphonenumber-js";

import type { EmergencyRecordData } from "./types.js";
import { RECORD_SCHEMA_VERSION } from "./types.js";

export type { EmergencyRecordData } from "./types.js";
export { RECORD_SCHEMA_VERSION } from "./types.js";

const normalizeText = (value: string): string =>
  value.normalize("NFC").trim().replace(/\s+/g, " ");

const normalizeList = (values: string[]): string[] =>
  [...new Set(values.map(normalizeText).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en"),
  );

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const phone = parsePhoneNumberFromString(trimmed, "NG");
  return phone?.isValid() ? phone.number : trimmed.replace(/\s+/g, " ");
}

/**
 * Normalizes all fields of an emergency record to their canonical form:
 * - Text fields: NFC, trimmed, single spaces
 * - List fields: deduped, sorted, each element normalized
 * - Phone numbers: E.164 when parseable as Nigerian number
 * - Emergency contacts: sorted by composite key
 */
export function normalizeEmergencyRecord(
  data: EmergencyRecordData,
): EmergencyRecordData {
  return {
    name: normalizeText(data.name),
    date_of_birth: data.date_of_birth || null,
    photo_url: data.photo_url?.trim() || null,
    language: data.language ? normalizeText(data.language) : null,
    blood_group: data.blood_group,
    genotype: data.genotype,
    allergies: normalizeList(data.allergies),
    medications: normalizeList(data.medications),
    chronic_conditions: normalizeList(data.chronic_conditions),
    emergency_contacts: data.emergency_contacts
      .map((contact) => ({
        name: normalizeText(contact.name),
        phone: normalizePhone(contact.phone),
        relationship: normalizeText(contact.relationship),
      }))
      .sort((a, b) =>
        `${a.name}\u0000${a.phone}\u0000${a.relationship}`.localeCompare(
          `${b.name}\u0000${b.phone}\u0000${b.relationship}`,
          "en",
        ),
      ),
  };
}

/**
 * Produces a stable, cross-repository canonical JSON string for an emergency
 * record. Presentation-only fields (date_of_birth, photo_url) and disclosure
 * choices are deliberately excluded.
 *
 * The output schema is versioned via `schemaVersion`. A change to the output
 * format requires a new schemaVersion and updated test vectors.
 */
export function canonicalizeEmergencyRecord(data: EmergencyRecordData): string {
  const normalized = normalizeEmergencyRecord(data);
  return JSON.stringify({
    schemaVersion: RECORD_SCHEMA_VERSION,
    name: normalized.name,
    bloodGroup: normalized.blood_group,
    genotype: normalized.genotype,
    allergies: normalized.allergies,
    medications: normalized.medications,
    chronicConditions: normalized.chronic_conditions,
    emergencyContacts: normalized.emergency_contacts,
    language: normalized.language,
  });
}

/**
 * Computes an HMAC-SHA256 commitment over the canonical form of an emergency
 * record. The secret (256-bit hex) must be held server-side and never exposed
 * to the browser or logged.
 *
 * This is a commitment scheme: without the secret, an adversary who has
 * perfectly guessed all fields cannot compute a matching commitment.
 */
export function computeRevisionCommitment(
  data: EmergencyRecordData,
  secretHex: string,
): string {
  if (!/^[0-9a-f]{64}$/i.test(secretHex)) {
    throw new Error("INVALID_RECORD_SECRET");
  }
  return createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(canonicalizeEmergencyRecord(data))
    .digest("hex");
}
