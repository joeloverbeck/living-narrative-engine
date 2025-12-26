# OPEHANNAMCOU-016: Migrate perception log handler to shared constants

## Summary

Replace inline component ID constants in `addPerceptionLogEntryHandler` with imports from `src/constants/componentIds.js`. Update unit tests to use the same constants and remove the matching allowlist entries from the static analysis test.

## Files to Touch

- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
- `src/constants/componentIds.js` (only if required constants are missing)
- `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`
- `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.targetDescription.test.js`
- `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js`

## Out of Scope

- No handler logic changes beyond constant sourcing.
- No mod JSON or schema changes.

## Changes

- Replace inline `*_COMPONENT_ID` constants in the handler with imports.
- Update unit tests to import the same constants (no duplicated string literals).
- Remove the matching legacy allowlist entries from `hardcodedConstantsStaticAnalysis.test.js`.

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.targetDescription.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage`

### Invariants

- No inline component ID constants remain in the handler.
- Unit tests import constants from the centralized file.
- `hardcodedConstantsStaticAnalysis.test.js` no longer allowlists the migrated constants.

## Dependencies

- `specs/operation-handler-namespace-coupling.md` (reference for constant sourcing rules).
