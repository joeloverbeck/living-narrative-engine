# ANACREMODMIG-012: Dredgers Toad Entity Tests (Verification)

## Status
Completed

## Summary
Confirm the dredgers integration tests for toad anatomy now target the migrated `anatomy-creatures` content. Tests are already written against the new namespace; this ticket is to validate they remain correct and catch any regressions introduced by the migration.

## Current Findings
- `tests/integration/mods/dredgers/toadEyeEntityLoading.test.js` already reads from `data/mods/anatomy-creatures/entities/definitions/toad_eye.entity.json` and asserts `anatomy-creatures:toad_eye`.
- `tests/integration/mods/dredgers/toadTympanumEntityLoading.test.js` already reads from `data/mods/anatomy-creatures/entities/definitions/toad_tympanum.entity.json` and asserts `anatomy-creatures:toad_tympanum`.
- No `dredgers:toad_*` references remain under `tests/integration/mods/dredgers/`.

## Scope
- Keep the tests aligned with the migrated anatomy-creatures entities and descriptors.
- Make only minimal edits if any discrepancies surface during verification (e.g., path/ID drift).

## Out of Scope
- Renaming/moving the test files.
- Changing test logic beyond what is needed to match current anatomy-creatures content.
- Updating dredgers character content (cress_siltwell, eira_quenreach) references.
- Touching other directories/tests (covered by separate tickets).

## Acceptance Criteria
- `npm run test:integration -- --testPathPatterns "toadEye|toadTympanum"` passes (run with `--coverage=false` on targeted suites to avoid global thresholds).
- Both tests assert anatomy-creatures IDs and load the correct entity definitions.
- No lingering `dredgers:toad_*` references in the dredgers integration test folder.

## Verification Commands
```bash
npm run test:integration -- --coverage=false --testPathPatterns "toadEye|toadTympanum"
rg "dredgers:toad_" tests/integration/mods/dredgers
```

## Dependencies
- ANACREMODMIG-003 (dredgers entities migrated)
- ANACREMODMIG-009 (game.json updated so mod loads)

## Blocks
- ANACREMODMIG-016 (final test validation)

## Outcome
- Tests were already aligned to the `anatomy-creatures` namespace and paths; no code changes were needed.
- Verified the toad eye and toad tympanum integration suites pass against anatomy-creatures assets with coverage disabled for the targeted run.
- Confirmed no stray `dredgers:toad_*` references remain under `tests/integration/mods/dredgers/`.
