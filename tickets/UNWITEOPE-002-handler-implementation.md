# UNWITEOPE-002: Create UnwieldItemHandler Implementation

## Summary

Create the `UnwieldItemHandler` class that encapsulates all logic for stopping wielding an item, including releasing grabbing appendages and cleaning up the wielding component.

## Files to Create

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/unwieldItemHandler.js` | Handler implementation |

## Implementation Details

### Handler Class Structure

```javascript
/**
 * @file Handler for the UNWIELD_ITEM operation
 * @description Stops wielding an item, releasing grabbing appendages and updating
 * the wielding component. Idempotent - succeeds silently if item is not currently wielded.
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { unlockAppendagesHoldingItem } from '../../utils/grabbingUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

class UnwieldItemHandler extends BaseOperationHandler {
  #logger;
  #entityManager;
  #safeEventDispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super();
    // Validate dependencies
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  async execute(context) {
    // Implementation follows spec execution flow
  }
}

export default UnwieldItemHandler;
```

### Execution Flow

The `execute(context)` method must implement:

1. **Validate Parameters**
   - Verify `actor_id` is a non-empty string
   - Verify `item_id` is a non-empty string
   - On validation failure, dispatch error and return `{ success: false }`

2. **Check Wielding Component**
   - Get `positioning:wielding` component from actor via `entityManager.getComponent(actorId, 'positioning:wielding')`
   - If component doesn't exist, return `{ success: true, wasWielding: false }` (idempotent)

3. **Check If Item Is Wielded**
   - Check if `item_id` is in `wielded_item_ids` array
   - If not found, return `{ success: true, wasWielding: false }` (idempotent)

4. **Get Grabbing Requirements**
   - Get `anatomy:requires_grabbing` component from item via `entityManager.getComponent(itemId, 'anatomy:requires_grabbing')`
   - Use `handsRequired` value (default: 1 if component missing)

5. **Unlock Grabbing Appendages**
   - Call `unlockAppendagesHoldingItem(entityManager, actorId, itemId)` from `grabbingUtils`
   - This unlocks ALL appendages holding the specific item

6. **Update Wielding Component**
   - Remove `item_id` from `wielded_item_ids` array
   - If array becomes empty, call `entityManager.removeComponent(actorId, 'positioning:wielding')`
   - Otherwise, update component with remaining items via `entityManager.updateComponent()`

7. **Dispatch Event**
   - Dispatch `items:item_unwielded` event with payload:
     ```javascript
     {
       actorId: string,
       itemId: string,
       remainingWieldedItems: string[]
     }
     ```

8. **Return Result**
   - Return `{ success: true, wasWielding: true }`

### Key Design Decisions

- **Idempotent**: Safe to call even if item is not wielded
- **Unlocks ALL appendages**: Uses `unlockAppendagesHoldingItem` which finds and unlocks all appendages holding the specific item
- **Component cleanup**: Removes `positioning:wielding` entirely when last item unwielded
- **Event dispatch**: Always dispatches event when unwield actually happens

## Out of Scope

- **DO NOT** create the schema (UNWITEOPE-001 must be completed first)
- **DO NOT** modify DI registrations (UNWITEOPE-003)
- **DO NOT** create unit tests in this ticket (UNWITEOPE-004)
- **DO NOT** modify any rule files (UNWITEOPE-005, UNWITEOPE-006)
- **DO NOT** create integration tests (UNWITEOPE-007)
- **DO NOT** modify any existing handler files

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Lint the new file
npx eslint src/logic/operationHandlers/unwieldItemHandler.js
```

Note: Full unit tests are in UNWITEOPE-004. This ticket focuses on implementation correctness.

### Manual Verification Checklist

1. [ ] File exists at `src/logic/operationHandlers/unwieldItemHandler.js`
2. [ ] Class extends `BaseOperationHandler`
3. [ ] Constructor validates all 3 dependencies (logger, entityManager, safeEventDispatcher)
4. [ ] `execute()` method handles all 8 execution steps from spec
5. [ ] Idempotent behavior: returns success when item not wielded
6. [ ] Uses `unlockAppendagesHoldingItem` from grabbingUtils
7. [ ] Uses `deepClone` when modifying component data
8. [ ] Dispatches `items:item_unwielded` event on successful unwield
9. [ ] Returns correct result shape `{ success: boolean, wasWielding: boolean }`

### Invariants That Must Remain True

- [ ] File follows project naming convention (camelCase)
- [ ] Uses `#privateField` syntax for private properties
- [ ] Uses JSDoc type annotations
- [ ] No direct console logging (uses logger)
- [ ] Error handling uses `safeDispatchError`
- [ ] File size under 500 lines

## Dependencies

- **Depends on**: UNWITEOPE-001 (schema must exist for validation)
- **Blocked by**: UNWITEOPE-001
- **Blocks**: UNWITEOPE-003 (DI registration needs handler class)

## Reference Files

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/unlockGrabbingHandler.js` | Similar appendage manipulation |
| `src/logic/operationHandlers/dropItemAtLocationHandler.js` | Similar item operation pattern |
| `src/utils/grabbingUtils.js` | `unlockAppendagesHoldingItem` function |
| `src/utils/cloneUtils.js` | `deepClone` function |
| `src/utils/safeDispatchErrorUtils.js` | Error dispatch pattern |
