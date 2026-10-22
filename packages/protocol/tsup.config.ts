import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    canonicalization: "src/canonicalization.ts",
    types: "src/types.ts",
    schemas: "src/schemas.ts",
    "test-vectors": "src/test-vectors.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Never bundle server-only or secret-handling code — this package is
  // designed to be consumed in browser, server, and contract contexts.
  // Any import of 'server-only', 'node:crypto' etc. is intentional only
  // for the HMAC computation; consumers that need it in the browser must
  // use the Web Crypto API equivalent (see README).
  platform: "neutral",
  target: "es2022",
  external: [],
  treeshake: true,
});
