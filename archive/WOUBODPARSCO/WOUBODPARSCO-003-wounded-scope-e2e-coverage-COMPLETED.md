# Summary
Add end-to-end coverage that builds an anatomy, applies damage, and asserts the first-aid scopes return only genuinely wounded/bleeding parts while the APPLY_DAMAGE pipeline continues to behave.

Status: Completed

# Reality check (current state)
- No e2e tests target medical scopes; similar coverage exists only for damage pipelines (e.g., `regenerateDescriptionAfterDamage.e2e.test.js`).
- Integration coverage already exercises the scope filters in isolation (`tests/integration/scopes/first-aid/woundedAndBleedingBodyParts.integration.test.js`), so e2e work should focus on how APPLY_DAMAGE mutations flow into real scope resolution.
- First-aid content ships only scopes (no actions/fixtures), so reuse existing APPLY_DAMAGE helpers instead of inventing triage-specific fixtures.

# Scope
- Create an e2e test under `tests/e2e/first-aid/` that:
  - Generates an anatomy with at least one damageable part (with joints/body graph).
  - Applies damage to drop `currentHealth` below `maxHealth` and optionally attaches `anatomy:bleeding`.
  - Resolves `first-aid` wounded/bleeding scopes and verifies only the altered parts are returned.
  - Confirms descriptions/health state stay consistent with existing APPLY_DAMAGE behavior (no regressions to damage math or unaffected parts).
- Reuse existing helpers/fixtures from APPLY_DAMAGE suites when possible to keep deterministic seeds.

# File list (expected to touch)
- tests/e2e/first-aid/woundedBodyParts.e2e.test.js (or similar)
- tests/e2e/first-aid/fixtures/* (if needed for anatomy seeds/entities)
- data/mods/first-aid/mod-manifest.json (if test fixture references require listed content)
- tests/e2e/helpers/* (only if minor shared helper tweaks are needed for first-aid setup)

# Out of scope
- Changing the APPLY_DAMAGE implementation or damage calculations.
- Adding UI rendering assertions beyond verifying returned scope IDs/metadata.
- Introducing new coverage gates (stick to targeted run, not full coverage enforcement).

# Acceptance criteria
- New e2e test passes via `npm run test:e2e -- --runInBand tests/e2e/first-aid/woundedBodyParts.e2e.test.js` and fails if scopes include healthy parts or omit wounded ones.
- Test also passes when run alongside existing APPLY_DAMAGE suites (no interference in shared fixtures).
- Assertions confirm both wounded-only and bleeding-filter variants behave as defined in the spec.

# Outcome
- Added `tests/e2e/first-aid/woundedBodyParts.e2e.test.js` that damages multiple parts through APPLY_DAMAGE, then resolves `first-aid:wounded_actor_body_parts` and `first-aid:bleeding_actor_body_parts` to ensure only harmed/bleeding parts are returned via BodyGraphService traversal.
- No mod data or scope definitions changed; the coverage builds on existing first-aid scopes and APPLY_DAMAGE helpers.
- Verified with `npm run test:e2e -- --runInBand tests/e2e/first-aid/woundedBodyParts.e2e.test.js`.

# Invariants that must remain true
- APPLY_DAMAGE pipeline behavior (events, health math, descriptions) matches prior expectations in existing tests.
- Other mods’ e2e suites continue to pass unchanged.
- Scope resolution still uses BodyGraphService cache without additional side effects.
