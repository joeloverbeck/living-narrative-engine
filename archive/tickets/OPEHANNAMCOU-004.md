# OPEHANNAMCOU-004: Update drinkEntirelyHandler to use centralized constants

## Summary

Refactor `drinkEntirelyHandler.js` and its unit test to import component and event IDs from centralized constants files instead of declaring them inline, per the handler namespace coupling spec.

## Files to Touch

- `src/logic/operationHandlers/drinkEntirelyHandler.js`
- `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`

## Out of Scope

- DO NOT modify the handler's `execute()` logic beyond constant references
- DO NOT change the handler's API/interface
- DO NOT modify other handlers
- DO NOT add new features or change behavior
- DO NOT change any test assertions other than updating imports/constant usage

## Changes

1. Add imports at top of file:

```javascript
import {
  POSITION_COMPONENT_ID,
  DRINKABLE_COMPONENT_ID,
  EMPTY_COMPONENT_ID,
  LIQUID_CONTAINER_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { LIQUID_CONSUMED_ENTIRELY_EVENT_ID } from '../../constants/eventIds.js';
```

2. Remove inline constant declarations (approximately lines 28-32):
   - `const LIQUID_CONTAINER_COMPONENT_ID = '...'` → remove, use import
   - `const DRINKABLE_COMPONENT_ID = '...'` → remove, use import
   - `const EMPTY_COMPONENT_ID = '...'` → remove, use import
   - `const POSITION_COMPONENT_ID = '...'` → remove, use import
   - `const LIQUID_CONSUMED_ENTIRELY_EVENT = '...'` → remove, use `LIQUID_CONSUMED_ENTIRELY_EVENT_ID`

3. Update all usages of `LIQUID_CONSUMED_ENTIRELY_EVENT` to use `LIQUID_CONSUMED_ENTIRELY_EVENT_ID`
4. Update `drinkEntirelyHandler.test.js` to import the same constants from `src/constants/componentIds.js` and `src/constants/eventIds.js`, removing inline constant definitions

## Acceptance Criteria

### Tests That Must Pass

- `npm run typecheck` passes
- `npx eslint src/logic/operationHandlers/drinkEntirelyHandler.js` passes
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js --no-coverage` passes

### Invariants

- Handler behavior unchanged (same inputs produce same outputs)
- No inline `const *_COMPONENT_ID = '...'` declarations remain in handler or its unit test
- No inline `const *_EVENT = '...'` declarations remain in handler or its unit test
- Handler API (`execute()` signature) unchanged
- All component/event ID strings match exactly what was previously hardcoded

## Dependencies

- OPEHANNAMCOU-001 (adds `LIQUID_CONSUMED_ENTIRELY_EVENT_ID` to eventIds.js)
- OPEHANNAMCOU-002 (adds `DRINKABLE_COMPONENT_ID`, `EMPTY_COMPONENT_ID` to componentIds.js)
- OPEHANNAMCOU-007 (adds `LIQUID_CONTAINER_COMPONENT_ID` to componentIds.js)

## Implementation Order

Phase 2: Handler Updates (depends on Phase 1 completion)

## Status

- Completed

## Outcome

- Updated `drinkEntirelyHandler.js` to import component/event IDs from centralized constants.
- Updated the drink-entirely unit test to use shared constants instead of inline strings.
