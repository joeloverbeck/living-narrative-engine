# MODTESTROB-010-01: Establish Migration Baseline for Batch 1 Suites

## Summary
Create the baseline context needed for migrating priority integration suites off legacy builders by validating helper coverage and capturing current usage metrics.

## Prerequisites
- Access to the documentation in `docs/testing/`.
- Node.js 20+ and npm 10+ installed (see repository `AGENTS.md`).

## Tasks
1. Read the following guides to confirm expectations for fixture helpers and assertions:
   - `docs/testing/mod-testing-guide.md`
   - `docs/testing/action-discovery-testing-toolkit.md`
   - `docs/testing/MODTESTROB-009-migration-guide.md`
2. Run targeted unit tests to ensure the shared scenario helpers and domain matchers are green:
   ```bash
   npm run test:unit -- tests/unit/common/mods/domainMatchers.test.js
   npm run test:unit -- tests/unit/common/mods/sittingScenarios.test.js
   npm run test:unit -- tests/unit/common/mods/inventoryScenarios.test.js
   ```
3. Capture the current counts for legacy helper usage so post-migration deltas can be measured:
   ```bash
   rg -l "ModEntityBuilder" tests/integration/mods | wc -l
   rg -l "ModAssertionHelpers" tests/integration/mods | wc -l
   rg -l "domainMatchers.js" tests/integration/mods | wc -l
   ```
4. Record the baseline values in `docs/testing/MODTESTROB-009-migration-guide.md` under a new Batch 1 entry.

## Acceptance Criteria
- All prerequisite documentation has been reviewed (note completion in ticket comments).
- The three unit test commands succeed without failures.
- Baseline counts for legacy builders, assertion helpers, and domain matcher adoption are documented in the migration guide.

## Validation
- Attach terminal logs for the unit test runs and `rg` counts to the ticket update.
