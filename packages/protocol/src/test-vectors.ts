/**
 * @lafiya/protocol — Canonical test vectors
 *
 * This module exports the authoritative test vectors used by the release
 * workflow to verify that canonicalization and commitment output has not
 * drifted across package versions.
 *
 * Rules:
 *  - A vector's `commitment` is the expected HMAC-SHA256 hex output for
 *    the given `secretHex` and `input`.
 *  - A vector's `canonical` is the exact JSON string produced by
 *    `canonicalizeEmergencyRecord(input)`.
 *  - Any change to either output for an existing vector is a BREAKING
 *    CHANGE and requires a new `schemaVersion` and a major version bump.
 *  - New vectors may be added in minor releases; existing vectors must
 *    never be modified.
 *
 * Semver alignment:
 *   schemaVersion=1 → @lafiya/protocol ^1.x.x
 */

import type { EmergencyRecordData } from "./types.js";

export type TestVector = {
  /** Human-readable description of what this vector exercises. */
  name: string;
  /** Schema version the vector was written against. */
  schemaVersion: 1;
  /** 64-character lowercase hex key used to compute the commitment. */
  secretHex: string;
  /** Raw input record (pre-normalization). */
  input: EmergencyRecordData;
  /**
   * Expected `canonicalizeEmergencyRecord(input)` output.
   * Pinned — any change to this string is a breaking change.
   */
  canonical: string;
  /**
   * Expected `computeRevisionCommitment(input, secretHex)` output.
   * Pinned — any change to this string is a breaking change.
   */
  commitment: string;
};

/**
 * Cross-repository canonical test vectors for schema version 1.
 *
 * These vectors are reproduced from `contracts/record-canonicalization-v1.json`
 * and are the single source of truth used by the release verification workflow.
 * They must pass before any version of this package is published.
 */
export const TEST_VECTORS_V1: readonly TestVector[] = [
  {
    name: "normalizes ordering, whitespace, unicode, and Nigerian phone",
    schemaVersion: 1,
    secretHex:
      "1111111111111111111111111111111111111111111111111111111111111111",
    input: {
      name: "  Amina   Yusuf ",
      date_of_birth: "1998-04-03",
      photo_url: "https://example.invalid/avatar.jpg",
      language: " Hausa ",
      blood_group: "O+",
      genotype: "AS",
      allergies: ["Penicillin", " Latex ", "Penicillin"],
      medications: ["Insulin"],
      chronic_conditions: ["Asthma"],
      emergency_contacts: [
        {
          name: " Halima Yusuf ",
          phone: "0801 234 5678",
          relationship: " Mother ",
        },
      ],
    },
    canonical:
      '{"schemaVersion":1,"name":"Amina Yusuf","bloodGroup":"O+","genotype":"AS","allergies":["Latex","Penicillin"],"medications":["Insulin"],"chronicConditions":["Asthma"],"emergencyContacts":[{"name":"Halima Yusuf","phone":"+2348012345678","relationship":"Mother"}],"language":"Hausa"}',
    commitment:
      "f7b383d4567cbfb5a8dbfa3d498764ed969651cec12276fbedde4dcaff4313b9",
  },
  {
    name: "empty optional fields produce stable canonical form",
    schemaVersion: 1,
    secretHex:
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    input: {
      name: "Test Patient",
      date_of_birth: null,
      photo_url: null,
      language: null,
      blood_group: "unknown",
      genotype: "unknown",
      allergies: [],
      medications: [],
      chronic_conditions: [],
      emergency_contacts: [],
    },
    canonical:
      '{"schemaVersion":1,"name":"Test Patient","bloodGroup":"unknown","genotype":"unknown","allergies":[],"medications":[],"chronicConditions":[],"emergencyContacts":[],"language":null}',
    commitment:
      "8f77b3ec755da741d11a975dae6a29a2be30b25d1638a46eda918b7bf9a082c7",
  },
  {
    name: "array deduplication and sorting is stable across re-ordering",
    schemaVersion: 1,
    secretHex:
      "2222222222222222222222222222222222222222222222222222222222222222",
    input: {
      name: "Chidi Okonkwo",
      date_of_birth: "1990-07-15",
      photo_url: null,
      language: "Igbo",
      blood_group: "B+",
      genotype: "AA",
      allergies: ["Sulfa", "Aspirin", "Sulfa"],
      medications: ["Metformin", "Amlodipine"],
      chronic_conditions: ["Hypertension", "Diabetes"],
      emergency_contacts: [
        { name: "Ada Okonkwo", phone: "+2347012345678", relationship: "Spouse" },
        {
          name: "Emeka Okonkwo",
          phone: "+2348098765432",
          relationship: "Brother",
        },
      ],
    },
    canonical:
      '{"schemaVersion":1,"name":"Chidi Okonkwo","bloodGroup":"B+","genotype":"AA","allergies":["Aspirin","Sulfa"],"medications":["Amlodipine","Metformin"],"chronicConditions":["Diabetes","Hypertension"],"emergencyContacts":[{"name":"Ada Okonkwo","phone":"+2347012345678","relationship":"Spouse"},{"name":"Emeka Okonkwo","phone":"+2348098765432","relationship":"Brother"}],"language":"Igbo"}',
    commitment:
      "67d3d6cca57c55fca258e030825440ebb8d1bb63b9ee2ef0d117c8f9c252d40d",
  },
] as const;

/** All test vectors grouped by schema version. */
export const ALL_TEST_VECTORS: Readonly<Record<1, readonly TestVector[]>> = {
  1: TEST_VECTORS_V1,
};
