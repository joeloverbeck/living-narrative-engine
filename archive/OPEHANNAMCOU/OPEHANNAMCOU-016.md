# OPEHANNAMCOU-016: Migrate perception log handler to shared constants

**Status**: COMPLETED

## Summary

Replace inline component ID constants in `addPerceptionLogEntryHandler` with imports from `src/constants/componentIds.js`. Remove the matching allowlist entries from the static analysis test.

## Ticket Corrections (Verified Against Codebase)

**Discrepancy 1**: `PERCEPTION_LOG_COMPONENT_ID` is already imported from centralized constants (line 27 of handler). Only 2 inline constants remain:
- `SENSORIAL_LINKS_COMPONENT_ID = 'locations:sensorial_links'` (line 39)
- `LOCATION_NAME_COMPONENT_ID = 'core:name'` (line 40)

**Discrepancy 2**: `SENSORIAL_LINKS_COMPONENT_ID` does NOT exist in `componentIds.js` - must be added.

**Discrepancy 3**: `LOCATION_NAME_COMPONENT_ID` should reuse existing `NAME_COMPONENT_ID = 'core:name'` from `componentIds.js` rather than creating a redundant constant.

**Discrepancy 4**: Unit tests already import `PERCEPTION_LOG_COMPONENT_ID` from centralized constants and do NOT duplicate inline constants. No test modifications required.

## Files to Touch

- `src/constants/componentIds.js` - **REQUIRED**: Add `SENSORIAL_LINKS_COMPONENT_ID`
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` - Update import, remove inline constants, replace `LOCATION_NAME_COMPONENT_ID` with `NAME_COMPONENT_ID`
- `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js` - Remove 2 allowlist entries

## Out of Scope

- No handler logic changes beyond constant sourcing.
- No mod JSON or schema changes.
- No unit test modifications (tests already use centralized constants).

## Changes

- Add `SENSORIAL_LINKS_COMPONENT_ID` to `src/constants/componentIds.js`.
- Remove inline constants from handler and import from centralized file.
- Replace `LOCATION_NAME_COMPONENT_ID` with existing `NAME_COMPONENT_ID`.
- Remove 2 legacy allowlist entries from `hardcodedConstantsStaticAnalysis.test.js`.

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.targetDescription.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage`

### Invariants

- No inline component ID constants remain in the handler.
- `hardcodedConstantsStaticAnalysis.test.js` no longer allowlists the migrated constants.

## Dependencies

- `specs/operation-handler-namespace-coupling.md` (reference for constant sourcing rules).

## Outcome

### What Changed vs Originally Planned

**Original Plan**:
- Migrate 3 inline component IDs from handler to centralized constants
- Update unit tests to use centralized constants
- Remove allowlist entries

**Actual Changes**:
1. `PERCEPTION_LOG_COMPONENT_ID` was already migrated - no action needed
2. Added `SENSORIAL_LINKS_COMPONENT_ID = 'locations:sensorial_links'` to `src/constants/componentIds.js`
3. Updated handler to import `NAME_COMPONENT_ID`, `PERCEPTION_LOG_COMPONENT_ID`, `SENSORIAL_LINKS_COMPONENT_ID` from centralized constants
4. Removed 2 inline constants from handler
5. Replaced `LOCATION_NAME_COMPONENT_ID` with existing `NAME_COMPONENT_ID` (no redundant alias created)
6. Removed 2 allowlist entries from static analysis test
7. **No test modifications required** - tests already used centralized constants

### Files Modified

| File | Change |
|------|--------|
| `src/constants/componentIds.js` | Added `SENSORIAL_LINKS_COMPONENT_ID` |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | Updated imports, removed 2 inline constants, replaced `LOCATION_NAME_COMPONENT_ID` with `NAME_COMPONENT_ID` |
| `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js` | Removed 2 allowlist entries |

### New/Modified Tests

None required. Existing test suites (53 unit tests, 4 target description tests, 2 static analysis tests) all pass without modification because:
- Tests already import `PERCEPTION_LOG_COMPONENT_ID` from centralized constants
- Tests do not duplicate inline component ID declarations
- Static analysis test automatically validates no new inline constants introduced

### Test Results

All 59 tests passed:
- `addPerceptionLogEntryHandler.test.js`: 53 passed
- `addPerceptionLogEntryHandler.targetDescription.test.js`: 4 passed
- `hardcodedConstantsStaticAnalysis.test.js`: 2 passed
