# Changelog

All notable changes to `@lafiya/protocol` are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-22

### Added

- Initial release of `@lafiya/protocol`.
- `types`: Domain types (`BloodGroup`, `Genotype`, `EmergencyContact`, `EmergencyRecordData`,
  `DisclosurePolicy`, `DEFAULT_DISCLOSURE_POLICY`), protocol error codes, `ProtocolError`,
  `TrustState`, `ProtocolEpoch`, `AttestationIntentPayload`, `SignedAttestationIntent`,
  `Attestation`, full intent state machine (`IntentState`, `IntentCommand`, `INTENT_TRANSITIONS`,
  `INTENT_TERMINAL_STATES`, `isTerminalIntentState`, `applyIntentCommand`).
- `canonicalization`: `normalizeEmergencyRecord`, `canonicalizeEmergencyRecord`,
  `computeRevisionCommitment` — identical logic to `lib/records/canonicalization.ts` but without
  any `server-only` guard, suitable for use in browser, server, and contract contexts.
- `schemas`: `RECORD_CANONICALIZATION_SCHEMA`, `CHW_ATTESTATION_PROTOCOL_SCHEMA`,
  `BLOOD_GROUP_VALUES`, `GENOTYPE_VALUES`.
- `test-vectors`: `TEST_VECTORS_V1` — three pinned vectors covering normalization, empty fields,
  and array deduplication/sorting. Commitments computed against `schemaVersion=1`.
- Dual ESM + CJS build via tsup, TypeScript declarations, source maps.
- `prepublishOnly` runs `test:vectors` — any drift in pinned output fails the build.
- Published with `provenance: true` (npm provenance from CI).
