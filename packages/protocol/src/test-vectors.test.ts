/**
 * @lafiya/protocol — test-vector verification suite
 *
 * This suite is run by `npm run test:vectors` before publishing and by the
 * release workflow (`release-protocol.yml`). It verifies that
 * `canonicalizeEmergencyRecord` and `computeRevisionCommitment` produce
 * exactly the pinned outputs in TEST_VECTORS_V1.
 *
 * A failure here is a breaking change: increment the schemaVersion and
 * publish a new major version of the package.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalizeEmergencyRecord,
  computeRevisionCommitment,
} from "./canonicalization.js";
import { ALL_TEST_VECTORS } from "./test-vectors.js";

describe("@lafiya/protocol test vectors — schema version 1", () => {
  const vectors = ALL_TEST_VECTORS[1];

  vectors.forEach((vector) => {
    describe(vector.name, () => {
      it("produces the pinned canonical JSON", () => {
        const actual = canonicalizeEmergencyRecord(vector.input);
        expect(actual).toBe(vector.canonical);
      });

      it("produces the pinned commitment", () => {
        const actual = computeRevisionCommitment(
          vector.input,
          vector.secretHex,
        );
        expect(actual).toBe(vector.commitment);
      });
    });
  });
});
