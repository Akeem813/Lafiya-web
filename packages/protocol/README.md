# @lafiya/protocol

Shared protocol types, canonicalization, hashing, intent schemas, and test vectors
for the Lafiya ecosystem.

## Purpose

Record canonicalization, intent types, and attestation schemas are needed by:
- The Lafiya web app
- CHW verifier tooling
- The contracts repo

This package is the single authoritative source. It is built to ESM and CJS
with TypeScript declarations and published with npm provenance from CI.

## Modules

| Import path | Contents |
|---|---|
| `@lafiya/protocol` | Everything — use for convenience |
| `@lafiya/protocol/types` | Domain types, error codes, state machine |
| `@lafiya/protocol/canonicalization` | Normalization, canonicalization, HMAC commitment |
| `@lafiya/protocol/schemas` | JSON Schema constants, value-set arrays |
| `@lafiya/protocol/test-vectors` | Pinned test vectors for the release verification |

## Semver rules

Tied to schema versions:

| Change | Version bump |
|---|---|
| Documentation, comments, no output change | PATCH |
| New optional fields, new exports, backward-compatible schema | MINOR |
| Any change to canonicalization output, commitment scheme, intent payload shape, or removal of an export | **MAJOR** |

A MAJOR bump requires a new `RECORD_SCHEMA_VERSION` constant and updated test vectors.
`schemaVersion` in the canonical JSON is independent of the npm package version.

## Platform notes

The `canonicalization` module uses Node's `node:crypto` for HMAC-SHA256.
Consumers running in **browser** contexts must use the Web Crypto API equivalent:

```ts
const key = await crypto.subtle.importKey(
  "raw",
  hexToBytes(secretHex),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
const commitment = bytesToHex(new Uint8Array(sig));
```

## Publishing

Published with `npm provenance` from the `release-protocol.yml` workflow.
The `prepublishOnly` script runs `test:vectors` — any drift in pinned output
fails the build before publication.

## Test vectors

The release workflow runs `npm run test:vectors` against the compiled package
before publishing. All vectors in `TEST_VECTORS_V1` must pass unchanged.
See `src/test-vectors.ts` for the authoritative vector list.
