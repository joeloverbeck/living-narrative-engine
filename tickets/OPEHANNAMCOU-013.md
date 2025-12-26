# OPEHANNAMCOU-013: Migrate inventory/container handlers to shared constants

## Summary

Replace inline component/event ID constants in inventory/container handlers with imports from `src/constants/componentIds.js` and `src/constants/eventIds.js`. Update unit tests to use the same constants and remove the matching allowlist entries from the static analysis test.

## Files to Touch

- `src/logic/operationHandlers/dropItemAtLocationHandler.js`
- `src/logic/operationHandlers/pickUpItemFromLocationHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`
- `src/logic/operationHandlers/transferItemHandler.js`
- `src/logic/operationHandlers/openContainerHandler.js`
- `src/logic/operationHandlers/validateContainerCapacityHandler.js`
- `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
- `src/constants/componentIds.js` (only if required constants are missing)
- `src/constants/eventIds.js` (only if required constants are missing)
- `tests/unit/logic/operationHandlers/dropItemAtLocationHandler.test.js`
- `tests/unit/logic/operationHandlers/pickUpItemFromLocationHandler.test.js`
- `tests/unit/logic/operationHandlers/putInContainerHandler.test.js`
- `tests/unit/logic/operationHandlers/takeFromContainerHandler.test.js`
- `tests/unit/logic/operationHandlers/transferItemHandler.test.js`
- `tests/unit/logic/operationHandlers/openContainerHandler.test.js`
- `tests/unit/logic/operationHandlers/validateContainerCapacityHandler.test.js`
- `tests/unit/logic/operationHandlers/validateInventoryCapacityHandler.test.js`
- `tests/unit/logic/operationHandlers/validateInventoryCapacityHandlerErrorDispatch.test.js`
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

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/dropItemAtLocationHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/pickUpItemFromLocationHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/putInContainerHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/takeFromContainerHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/transferItemHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/openContainerHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/validateContainerCapacityHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/validateInventoryCapacityHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/validateInventoryCapacityHandlerErrorDispatch.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage`

### Invariants

- No inline component/event ID constants remain in these handlers.
- Unit tests import constants from the centralized files.
- `hardcodedConstantsStaticAnalysis.test.js` no longer allowlists the migrated constants.

## Dependencies

- `specs/operation-handler-namespace-coupling.md` (reference for constant sourcing rules).
