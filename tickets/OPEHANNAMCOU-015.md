# OPEHANNAMCOU-015: Migrate breathing handlers to shared constants

## Summary

Replace inline component/event ID constants in breathing handlers with imports from `src/constants/componentIds.js` and `src/constants/eventIds.js`. Update unit tests to use the same constants and remove the matching allowlist entries from the static analysis test.

## Files to Touch

- `src/logic/operationHandlers/depleteOxygenHandler.js`
- `src/logic/operationHandlers/restoreOxygenHandler.js`
- `src/constants/componentIds.js` (only if required constants are missing)
- `src/constants/eventIds.js` (only if required constants are missing)
- `tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js`
- `tests/unit/logic/operationHandlers/restoreOxygenHandler.test.js`
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

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/restoreOxygenHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage`

### Invariants

- No inline component/event ID constants remain in these handlers.
- Unit tests import constants from the centralized files.
- `hardcodedConstantsStaticAnalysis.test.js` no longer allowlists the migrated constants.

## Dependencies

- `specs/operation-handler-namespace-coupling.md` (reference for constant sourcing rules).
