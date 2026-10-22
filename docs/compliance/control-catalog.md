# Compliance Control Catalog

**Status:** Active  
**Owner:** Privacy Engineering  
**Evidence collection:** Automated — `scripts/collect-compliance-evidence.mjs`  
**Retention:** 1 year (compliance-evidence/ directory, uploaded as GitHub Actions artifacts)  
**Related:** `docs/compliance/dpia.md`, `docs/compliance/ropa.md`, `compliance/residency.json`

---

## Purpose

This catalog defines the machine-checkable controls that are automatically
collected by the compliance evidence pipeline. It is the authoritative reference
for audit and funder reviews.

Evidence bundles are signed with HMAC-SHA256 using a key stored in GitHub
Secrets (`COMPLIANCE_EVIDENCE_SIGNING_KEY`), collected weekly via
`.github/workflows/compliance-evidence.yml`, and verified by
`scripts/verify-compliance-bundle.mjs`.

No PHI appears in any evidence artifact — this is enforced by the PHI detection
scan in `collect-compliance-evidence.mjs` (exit 1 on detection) and verified
during bundle validation.

---

## Control definitions

### CI controls

| ID | Control | Evidence source | Automated |
|---|---|---|---|
| CI-001 | Continuous integration passes | GitHub Actions CI run ID and SHA | ✅ |
| CI-002 | Database RLS audit passes | `scripts/audit-rls.mjs` presence and CI run | ✅ |
| CI-003 | Schema drift check passes | `scripts/check-schema-drift.mjs` presence and CI run | ✅ |
| CI-004 | Secret scan passes | `scripts/scan-secrets.mjs` presence and CI run | ✅ |
| CI-005 | Dependency audit (no critical CVEs) | `.github/workflows/supply-chain.yml` presence | ✅ |
| CI-006 | SBOM provenance attestation | `mainnet-release.yml` provenance step, build revision | ✅ |
| CI-007 | RoPA freshness check | `scripts/generate-ropa.mjs` + `docs/compliance/ropa.md` | ✅ |

### Security controls

| ID | Control | Evidence source | Automated |
|---|---|---|---|
| SEC-001 | Content Security Policy headers set | `proxy.ts` CSP header configuration | ✅ |
| SEC-002 | Row Level Security enabled on all public tables | Migration SQL files (`enable row level security`) | ✅ |
| SEC-003 | Service-role admin client requires purpose label | `lib/supabase/admin.ts` AdminPurpose enforcement | ✅ |

### Privacy controls

| ID | Control | Evidence source | Automated |
|---|---|---|---|
| PRIV-001 | PHI exclusion from telemetry dimensions | `docs/operations/mainnet-assurance.md` safe-dimensions policy | ✅ |
| PRIV-002 | DPIA in place for emergency card system | `docs/compliance/dpia.md` risk register | ✅ |
| PRIV-003 | Data residency policy configured | `compliance/residency.json` processor list | ✅ |

---

## Evidence bundle format

Each bundle is a JSON file at `compliance-evidence/compliance-index-<period>.json`:

```json
{
  "schemaVersion": 1,
  "period": "2026-10",
  "generatedAt": "2026-10-22T08:00:00Z",
  "buildRevision": "<git sha>",
  "runId": "<github run id>",
  "repository": "org/lafiya-web",
  "summary": { "total": 13, "passed": 12, "failed": 0, "skipped": 1 },
  "controls": [
    {
      "id": "CI-001",
      "name": "Continuous integration passes",
      "collectedAt": "...",
      "runId": "...",
      "buildRevision": "...",
      "status": "pass",
      "value": { "runId": "...", "sha": "...", "workflowRef": "..." }
    }
  ],
  "signed": true
}
```

A `.sig` file alongside the JSON contains the HMAC-SHA256 hex signature.

---

## Verification

```bash
# Verify a bundle locally (requires COMPLIANCE_EVIDENCE_SIGNING_KEY in env)
node scripts/verify-compliance-bundle.mjs \
  compliance-evidence/compliance-index-2026-10.json \
  compliance-evidence/compliance-index-2026-10.sig
```

Exit codes:
- `0` — valid, complete, and PHI-free
- `1` — signature mismatch, missing controls, or PHI detected
- `2` — usage error

---

## Retention and access

- **Retention period:** 1 year minimum.
- **Storage:** `compliance-evidence/` directory in the repository and GitHub Actions artifacts (365-day retention).
- **Access:** Repository read access (developers, auditors). The signing key is in GitHub Secrets and never appears in artifacts.

---

## Adding controls

To add a new control:
1. Add an entry to the `CONTROLS` array in `scripts/collect-compliance-evidence.mjs`.
2. Implement the `collect()` function — it must return `{ status, value }` with no PHI.
3. Add the control ID to `REQUIRED_CONTROL_IDS` in `scripts/verify-compliance-bundle.mjs` if it is mandatory.
4. Document it in the table above.
5. Run `node scripts/collect-compliance-evidence.mjs --dry-run` to validate.
