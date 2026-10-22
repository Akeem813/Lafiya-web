/**
 * @lafiya/protocol — Public entry point
 *
 * Re-exports every public symbol from the sub-modules. Consumers that
 * only need a subset should import directly from the sub-module path
 * (e.g. `@lafiya/protocol/canonicalization`) to keep their bundle lean.
 *
 * This package is platform-neutral: it does not import `server-only`,
 * database clients, or secret-handling utilities. The HMAC computation in
 * `canonicalization` uses Node's `node:crypto`; browser consumers must
 * use the Web Crypto API equivalent (see package README).
 */

// Types, constants, and state machine
export * from "./types.js";

// Normalization, canonicalization, and commitment
export * from "./canonicalization.js";

// JSON Schema constants and value-set arrays
export * from "./schemas.js";
