# OPEHANNAMCOU-006: Verify drinkEntirelyHandler.test.js imports constants

## Summary

Confirm `drinkEntirelyHandler.test.js` already imports component and event IDs from centralized constants files, ensuring the test uses the same source of truth as the handler.

## Files to Touch

- `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`

## Out of Scope

- DO NOT modify the handler source file
- DO NOT add new test cases
- DO NOT change test assertions or mock behavior

## Changes

1. Verify imports at top of file include:
   - `POSITION_COMPONENT_ID`, `DRINKABLE_COMPONENT_ID`, `EMPTY_COMPONENT_ID`, `LIQUID_CONTAINER_COMPONENT_ID` from `src/constants/componentIds.js`
   - `LIQUID_CONSUMED_ENTIRELY_EVENT_ID` from `src/constants/eventIds.js`
2. Confirm there are no inline `*_COMPONENT_ID` or `LIQUID_CONSUMED_ENTIRELY_EVENT` declarations.
3. Ensure assertions already reference the imported constants.

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js --no-coverage` passes
- `npx eslint tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js` passes

### Invariants

- Test coverage unchanged (same test cases)
- No duplicated constants that exist in centralized files
- All tests pass with same behavior
- Mock expectations use imported constants, not hardcoded strings

## Dependencies

- OPEHANNAMCOU-001 (adds `LIQUID_CONSUMED_ENTIRELY_EVENT_ID` to eventIds.js)
- OPEHANNAMCOU-002 (adds `DRINKABLE_COMPONENT_ID`, `EMPTY_COMPONENT_ID` to componentIds.js)
- OPEHANNAMCOU-007 (adds `LIQUID_CONTAINER_COMPONENT_ID` to componentIds.js)

## Implementation Order

Phase 3: Test Verification (depends on Phase 1 completion)

## Notes

The test already imports constants, so no code changes are expected beyond verification.

## Status

Completed.

## Outcome

The test already matched the planned constant-import pattern, so no code changes were required; the work focused on verification and confirming the scope.
