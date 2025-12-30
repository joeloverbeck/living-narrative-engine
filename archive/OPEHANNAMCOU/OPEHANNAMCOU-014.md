# OPEHANNAMCOU-014: Migrate anatomy/health handlers to shared constants

## Summary

Replace inline component/event ID constants in anatomy/health handlers with imports from `src/constants/componentIds.js` and `src/constants/eventIds.js`. Update unit tests to use the same constants and remove the matching allowlist entries from the static analysis test.

## Files to Touch

- `src/logic/operationHandlers/applyDamageHandler.js`
- `src/logic/operationHandlers/modifyPartHealthHandler.js`
- `src/logic/operationHandlers/updatePartHealthStateHandler.js`
- `src/constants/componentIds.js` (only if required constants are missing)
- `src/constants/eventIds.js` (only if required constants are missing)
- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`
- `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js`
- `tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js`
- `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js`

## Out of Scope

- No handler logic changes beyond constant sourcing.
- No mod JSON or schema changes.

## Changes

- Replace inline `*_COMPONENT_ID` and `*_EVENT` constants in the listed handlers with imports.
- Update the unit tests to import the same constants (no duplicated string literals).
- Remove the matching legacy allowlist entries from `hardcodedConstantsStaticAnalysis.test.js`.

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/applyDamageHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage`

### Invariants

- No inline component/event ID constants remain in these handlers.
- Unit tests import constants from the centralized files.
- `hardcodedConstantsStaticAnalysis.test.js` no longer allowlists the migrated constants.

## Dependencies

- `specs/operation-handler-namespace-coupling.md` (reference for constant sourcing rules).

## Outcome

**Status**: ✅ Completed

### Changes Made

1. **Added new shared constants**:
   - `ANATOMY_PART_HEALTH_COMPONENT_ID` to `src/constants/componentIds.js`
   - `PART_HEALTH_CHANGED_EVENT_ID` and `PART_STATE_CHANGED_EVENT_ID` to `src/constants/eventIds.js`

2. **Updated handlers to use shared constants**:
   - `applyDamageHandler.js`: Replaced inline `BODY_COMPONENT_ID`, `PART_COMPONENT_ID` with imports from `componentIds.js`
   - `modifyPartHealthHandler.js`: Replaced inline `PART_HEALTH_COMPONENT_ID`, `PART_COMPONENT_ID`, `PART_HEALTH_CHANGED_EVENT` with imports
   - `updatePartHealthStateHandler.js`: Replaced inline `PART_HEALTH_COMPONENT_ID`, `PART_COMPONENT_ID`, `PART_STATE_CHANGED_EVENT` with imports

3. **Updated unit tests**:
   - All three handler test files now import constants from `componentIds.js` and `eventIds.js`
   - Test-only mock event IDs (`DAMAGE_APPLIED_EVENT`, `PART_DESTROYED_EVENT`) remain inline as they're not production constants

4. **Removed legacy allowlist entries**:
   - Removed 8 entries from `LEGACY_INLINE_CONSTANTS` in `hardcodedConstantsStaticAnalysis.test.js`

### Tests Verified

All acceptance criteria tests pass:
- `applyDamageHandler.test.js`: 186 tests passed
- `modifyPartHealthHandler.test.js`: Included in above
- `updatePartHealthStateHandler.test.js`: Included in above
- `hardcodedConstantsStaticAnalysis.test.js`: 2 tests passed
