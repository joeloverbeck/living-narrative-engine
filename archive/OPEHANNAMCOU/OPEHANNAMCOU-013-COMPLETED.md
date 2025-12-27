# OPEHANNAMCOU-013: Migrate inventory/container handlers to shared constants

**Status**: ✅ COMPLETED

## Summary

Replace inline component/event ID constants in inventory/container handlers with imports from `src/constants/componentIds.js` and `src/constants/eventIds.js`. Update unit tests to use the same constants and remove the matching allowlist entries from the static analysis test.

## Assumption Corrections (from reassessment)

The following discrepancies were found during codebase analysis:

1. **Missing component constants** (need to be added to componentIds.js):
   - `ITEM_COMPONENT_ID` = `'items-core:item'` (used inline in dropItemAtLocationHandler.js:239)
   - `PORTABLE_COMPONENT_ID` = `'items-core:portable'` (used inline in dropItemAtLocationHandler.js:243)

2. **Missing event constants** (need to be added to eventIds.js):
   - `ITEM_DROPPED_EVENT_ID` = `'inventory:item_dropped'`
   - `ITEM_PICKED_UP_EVENT_ID` = `'inventory:item_picked_up'`
   - `ITEM_PUT_IN_CONTAINER_EVENT_ID` = `'containers:item_put_in_container'`
   - `ITEM_TAKEN_FROM_CONTAINER_EVENT_ID` = `'containers:item_taken_from_container'`
   - `ITEM_TRANSFERRED_EVENT_ID` = `'inventory:item_transferred'`
   - `CONTAINER_OPENED_EVENT_ID` = `'containers:container_opened'`

## Files to Touch

- `src/logic/operationHandlers/dropItemAtLocationHandler.js`
- `src/logic/operationHandlers/pickUpItemFromLocationHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`
- `src/logic/operationHandlers/transferItemHandler.js`
- `src/logic/operationHandlers/openContainerHandler.js`
- `src/logic/operationHandlers/validateContainerCapacityHandler.js`
- `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
- `src/constants/componentIds.js` - Add ITEM_COMPONENT_ID, PORTABLE_COMPONENT_ID
- `src/constants/eventIds.js` - Add 6 event IDs listed above
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

## Outcome

### Implementation Summary

Successfully migrated 8 inventory/container handlers from inline constants to centralized imports:

**Constants Added:**
- `src/constants/componentIds.js`: Added `ITEM_COMPONENT_ID`, `PORTABLE_COMPONENT_ID`
- `src/constants/eventIds.js`: Added 6 event IDs (`ITEM_DROPPED_EVENT_ID`, `ITEM_PICKED_UP_EVENT_ID`, `ITEM_PUT_IN_CONTAINER_EVENT_ID`, `ITEM_TAKEN_FROM_CONTAINER_EVENT_ID`, `ITEM_TRANSFERRED_EVENT_ID`, `CONTAINER_OPENED_EVENT_ID`)

**Handlers Updated (8 files):**
1. `dropItemAtLocationHandler.js` - Imports from componentIds.js and eventIds.js
2. `pickUpItemFromLocationHandler.js` - Imports from componentIds.js and eventIds.js
3. `putInContainerHandler.js` - Imports from componentIds.js and eventIds.js
4. `takeFromContainerHandler.js` - Imports from componentIds.js and eventIds.js
5. `transferItemHandler.js` - Imports from componentIds.js and eventIds.js
6. `openContainerHandler.js` - Imports from componentIds.js and eventIds.js
7. `validateContainerCapacityHandler.js` - Imports from componentIds.js
8. `validateInventoryCapacityHandler.js` - Imports from componentIds.js

**Tests Updated (9 files):**
All corresponding test files now import constants from the same centralized sources, ensuring test constants match handler constants.

**Static Analysis Allowlist:**
Removed 18 legacy entries from `hardcodedConstantsStaticAnalysis.test.js` for the migrated handlers.

### Test Results

All 9 handler unit tests pass (129 tests total):
```
PASS tests/unit/logic/operationHandlers/takeFromContainerHandler.test.js
PASS tests/unit/logic/operationHandlers/transferItemHandler.test.js
PASS tests/unit/logic/operationHandlers/validateInventoryCapacityHandler.test.js
PASS tests/unit/logic/operationHandlers/pickUpItemFromLocationHandler.test.js
PASS tests/unit/logic/operationHandlers/validateInventoryCapacityHandlerErrorDispatch.test.js
PASS tests/unit/logic/operationHandlers/dropItemAtLocationHandler.test.js
PASS tests/unit/logic/operationHandlers/validateContainerCapacityHandler.test.js
PASS tests/unit/logic/operationHandlers/putInContainerHandler.test.js
PASS tests/unit/logic/operationHandlers/openContainerHandler.test.js

Test Suites: 9 passed, 9 total
Tests:       129 passed, 129 total
```

Static analysis test passes:
```
PASS tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js
  ✓ blocks new inline component ID constants in handlers
  ✓ blocks new inline event ID constants in handlers
```

### Invariants Verified

✅ No inline component/event ID constants remain in the 8 migrated handlers
✅ Unit tests import constants from centralized files (no duplicated string literals)
✅ Static analysis allowlist no longer contains entries for migrated handlers
