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

---

## Outcome

**Status**: COMPLETED

**Implementation Summary**:

1. **Added centralized constants**:
   - `RESPIRATORY_ORGAN_COMPONENT_ID = 'breathing-states:respiratory_organ'` to `componentIds.js`
   - `OXYGEN_DEPLETED_EVENT_ID = 'breathing-states:oxygen_depleted'` to `eventIds.js`

2. **Updated handlers with imports** (using aliasing for minimal code change):
   - `depleteOxygenHandler.js`: Replaced 3 inline constants with imports
   - `restoreOxygenHandler.js`: Replaced 2 inline constants with imports
   - Import aliasing used: `ANATOMY_PART_COMPONENT_ID as PART_COMPONENT_ID` and `OXYGEN_DEPLETED_EVENT_ID as OXYGEN_DEPLETED_EVENT`

3. **Updated tests with centralized imports**:
   - `depleteOxygenHandler.test.js`: Now imports constants from `componentIds.js` and `eventIds.js`
   - `restoreOxygenHandler.test.js`: Now imports constants from `componentIds.js`

4. **Removed 5 allowlist entries** from `hardcodedConstantsStaticAnalysis.test.js`

**Ticket Assumption Correction**: The handlers used `PART_COMPONENT_ID` but `componentIds.js` already had `ANATOMY_PART_COMPONENT_ID = 'anatomy:part'`. Solution: ES6 import aliasing preserved handler code unchanged while using the centralized constant.

**All tests pass**:
- `depleteOxygenHandler.test.js`: 28 tests passed
- `restoreOxygenHandler.test.js`: 24 tests passed
- `hardcodedConstantsStaticAnalysis.test.js`: 2 tests passed
