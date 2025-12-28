# OPEHANNAMCOU-018: Migrate unwield handler to shared constants

## Summary

Replace inline component/event ID constants in `unwieldItemHandler` with imports from centralized constants. Add the missing `WIELDING_COMPONENT_ID` and `ITEM_UNWIELDED_EVENT` exports to the constants modules, update unit tests to import them, and remove the matching allowlist entries from the static analysis test.

## Files to Touch

- `src/logic/operationHandlers/unwieldItemHandler.js`
- `src/constants/componentIds.js` (add `WIELDING_COMPONENT_ID`)
- `src/constants/eventIds.js` (add `ITEM_UNWIELDED_EVENT`)
- `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js`
- `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js`

## Out of Scope

- No handler logic changes beyond constant sourcing.
- No mod JSON or schema changes.

## Assumptions Reassessed

- `src/constants/eventIds.js` already exists; it just lacks the `ITEM_UNWIELDED_EVENT` export.
- `src/constants/componentIds.js` does not yet include `WIELDING_COMPONENT_ID`.
- The static analysis test currently allowlists the inline constants in `unwieldItemHandler`.

## Changes

- Replace inline `*_COMPONENT_ID` and `*_EVENT` constants in the handler with imports from the constants modules.
- Add the missing `WIELDING_COMPONENT_ID` and `ITEM_UNWIELDED_EVENT` exports.
- Update the unit test to import the same constants (no duplicated string literals).
- Remove the matching legacy allowlist entries from `hardcodedConstantsStaticAnalysis.test.js`.

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/unwieldItemHandler.test.js --runInBand --no-coverage`
- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage`

### Invariants

- No inline component/event ID constants remain in the handler.
- Unit tests import constants from the centralized files.
- `hardcodedConstantsStaticAnalysis.test.js` no longer allowlists the migrated constants.

## Dependencies

- `specs/operation-handler-namespace-coupling.md` (reference for constant sourcing rules).

## Status

Completed

## Outcome

Added the missing constants to `componentIds.js` and `eventIds.js`, updated the handler and unit test to import them, and removed the legacy allowlist entries. No handler logic changes were needed beyond constant sourcing.
