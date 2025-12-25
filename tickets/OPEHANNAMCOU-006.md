# OPEHANNAMCOU-006: Update drinkEntirelyHandler.test.js to import constants

## Summary

Refactor `drinkEntirelyHandler.test.js` to import component and event IDs from centralized constants files instead of declaring them inline, ensuring tests use the same source of truth as the handler.

## Files to Touch

- `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`

## Out of Scope

- DO NOT modify the handler source file
- DO NOT add new test cases
- DO NOT modify test logic beyond updating constant references
- DO NOT change test assertions or mock behavior

## Changes

1. Add imports at top of file:

```javascript
import {
  POSITION_COMPONENT_ID,
  DRINKABLE_COMPONENT_ID,
  EMPTY_COMPONENT_ID,
  LIQUID_CONTAINER_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { LIQUID_CONSUMED_ENTIRELY_EVENT_ID } from '../../../../src/constants/eventIds.js';
```

2. Remove inline constant declarations (approximately lines 24-28):
   - Remove all `const *_COMPONENT_ID = '...'` declarations
   - Remove `const LIQUID_CONSUMED_ENTIRELY_EVENT = '...'` declaration

3. Update test assertions to use imported constants:
   - Replace `LIQUID_CONSUMED_ENTIRELY_EVENT` with `LIQUID_CONSUMED_ENTIRELY_EVENT_ID`

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

Phase 3: Test Updates (depends on Phase 1 completion)

## Notes

This ticket can be done in parallel with OPEHANNAMCOU-004 (handler update) as long as Phase 1 is complete, but running both changes together ensures the test still passes with the updated handler.
