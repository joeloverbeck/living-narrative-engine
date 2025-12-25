# OPEHANNAMCOU-003: Update drinkFromHandler to use centralized constants

## Summary

Refactor `drinkFromHandler.js` to import component and event IDs from centralized constants files instead of declaring them inline, and align its unit test with the shared constants.

## Files to Touch

- `src/logic/operationHandlers/drinkFromHandler.js`
- `src/constants/componentIds.js`
- `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`

## Out of Scope

- DO NOT modify the handler's `execute()` logic beyond constant references
- DO NOT change the handler's API/interface
- DO NOT modify other handlers
- DO NOT add new features or change behavior

## Changes

1. Add imports at top of file:

```javascript
import {
  POSITION_COMPONENT_ID,
  DRINKABLE_COMPONENT_ID,
  EMPTY_COMPONENT_ID,
  LIQUID_CONTAINER_COMPONENT_ID,
  LIQUID_CONTAINER_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { LIQUID_CONSUMED_EVENT_ID } from '../../constants/eventIds.js';
```

2. Remove inline constant declarations (approximately lines 28-32):
   - `const LIQUID_CONTAINER_COMPONENT_ID = '...'` → remove, use import
   - `const DRINKABLE_COMPONENT_ID = '...'` → remove, use import
   - `const EMPTY_COMPONENT_ID = '...'` → remove, use import
   - `const POSITION_COMPONENT_ID = '...'` → remove, use import
   - `const LIQUID_CONSUMED_EVENT = '...'` → remove, use `LIQUID_CONSUMED_EVENT_ID`

3. Update all usages of `LIQUID_CONSUMED_EVENT` to use `LIQUID_CONSUMED_EVENT_ID`

4. Add `LIQUID_CONTAINER_COMPONENT_ID` to `src/constants/componentIds.js` if it is not already defined.

5. Update `tests/unit/logic/operationHandlers/drinkFromHandler.test.js` to import component IDs from `src/constants/componentIds.js` instead of duplicating strings.

## Acceptance Criteria

### Tests That Must Pass

- `npm run typecheck` passes
- `npx eslint src/logic/operationHandlers/drinkFromHandler.js` passes
- `NODE_ENV=test npx jest tests/unit/logic/operationHandlers/drinkFromHandler.test.js --no-coverage` passes

### Invariants

- Handler behavior unchanged (same inputs produce same outputs)
- No inline `const *_COMPONENT_ID = '...'` declarations remain in handler
- No inline `const *_EVENT = '...'` declarations remain in handler
- Handler API (`execute()` signature) unchanged
- All component/event ID strings match exactly what was previously hardcoded

## Dependencies

- OPEHANNAMCOU-001 (adds `LIQUID_CONSUMED_EVENT_ID` to eventIds.js) — already present.
- OPEHANNAMCOU-002 (adds `DRINKABLE_COMPONENT_ID`, `EMPTY_COMPONENT_ID` to componentIds.js) — already present.
- OPEHANNAMCOU-007 (adds `LIQUID_CONTAINER_COMPONENT_ID` to componentIds.js) — not present; include in this ticket.

## Implementation Order

Phase 2: Handler Updates (depends on Phase 1 completion)

## Status

- Completed

## Outcome

- Updated `drinkFromHandler.js` to import component/event IDs from centralized constants.
- Added `LIQUID_CONTAINER_COMPONENT_ID` to `src/constants/componentIds.js`.
- Updated the drink-from unit test to use shared constants instead of inline strings.
