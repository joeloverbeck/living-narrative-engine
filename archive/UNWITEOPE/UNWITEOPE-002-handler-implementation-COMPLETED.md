# UNWITEOPE-002: Create UnwieldItemHandler Implementation

## Status: ✅ COMPLETED

## Summary

Create the `UnwieldItemHandler` class that encapsulates all logic for stopping wielding an item, including releasing grabbing appendages and cleaning up the wielding component.

## Assumption Corrections (Applied During Implementation)

The following assumptions from the original ticket were corrected to match actual codebase patterns:

| Original Assumption                      | Correction                      | Rationale                                 |
| ---------------------------------------- | ------------------------------- | ----------------------------------------- |
| Parameters: `actor_id`, `item_id`        | Use `actorEntity`, `itemEntity` | Match schema in `unwieldItem.schema.json` |
| `entityManager.getComponent()`           | Use `getComponentData()`        | Consistent with modern handlers           |
| `entityManager.updateComponent()`        | Use `addComponent()` (upsert)   | `updateComponent()` doesn't exist         |
| Return `{ success, wasWielding }`        | Return `{ success, error? }`    | Match `DropItemAtLocationHandler` pattern |
| Constructor calls `super()` with no args | Use `super(name, deps)` pattern | Match modern handler validation pattern   |

## Files Created

| File                                                | Purpose                |
| --------------------------------------------------- | ---------------------- |
| `src/logic/operationHandlers/unwieldItemHandler.js` | Handler implementation |

## Implementation Details

### Handler Class Structure

```javascript
/**
 * @file Handler for UNWIELD_ITEM operation
 * @description Stops wielding an item, releasing grabbing appendages and updating
 * the wielding component. Idempotent - succeeds silently if item is not currently wielded.
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { unlockAppendagesHoldingItem } from '../../utils/grabbingUtils.js';
import {
  assertParamsObject,
  validateStringParam,
} from '../../utils/handlerUtils/paramsUtils.js';

class UnwieldItemHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UnwieldItemHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'addComponent',
          'removeComponent',
        ],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    // Implementation follows corrected execution flow
  }
}

export default UnwieldItemHandler;
```

### Execution Flow

The `execute(params, executionContext)` method implements:

1. **Validate Parameters**
   - Verify `actorEntity` is a non-empty string
   - Verify `itemEntity` is a non-empty string
   - On validation failure, return `{ success: false, error: 'validation_failed' }`

2. **Check Wielding Component**
   - Get `positioning:wielding` component from actor via `entityManager.getComponentData(actorEntity, 'positioning:wielding')`
   - If component doesn't exist, return `{ success: true }` (idempotent)

3. **Check If Item Is Wielded**
   - Check if `itemEntity` is in `wielded_item_ids` array
   - If not found, return `{ success: true }` (idempotent)

4. **Unlock Grabbing Appendages**
   - Call `unlockAppendagesHoldingItem(entityManager, actorEntity, itemEntity)` from `grabbingUtils`
   - This unlocks ALL appendages holding the specific item

5. **Update Wielding Component**
   - Remove `itemEntity` from `wielded_item_ids` array
   - If array becomes empty, call `entityManager.removeComponent(actorEntity, 'positioning:wielding')`
   - Otherwise, update component with remaining items via `entityManager.addComponent()` (upsert)

6. **Dispatch Event**
   - Dispatch `items:item_unwielded` event with payload:
     ```javascript
     {
       actorEntity: string,
       itemEntity: string,
       remainingWieldedItems: string[]
     }
     ```

7. **Return Result**
   - Return `{ success: true }`

### Key Design Decisions

- **Idempotent**: Safe to call even if item is not wielded
- **Unlocks ALL appendages**: Uses `unlockAppendagesHoldingItem` which finds and unlocks all appendages holding the specific item
- **Component cleanup**: Removes `positioning:wielding` entirely when last item unwielded
- **Event dispatch**: Always dispatches event when unwield actually happens
- **Pattern alignment**: Follows `DropItemAtLocationHandler` pattern for consistency

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

1. [x] File exists at `src/logic/operationHandlers/unwieldItemHandler.js`
2. [x] Class extends `BaseOperationHandler`
3. [x] Constructor validates all 3 dependencies via `super(name, deps)` pattern
4. [x] `execute()` method handles all execution steps from spec
5. [x] Idempotent behavior: returns success when item not wielded
6. [x] Uses `unlockAppendagesHoldingItem` from grabbingUtils
7. [x] Dispatches `items:item_unwielded` event on successful unwield
8. [x] Returns correct result shape `{ success: boolean, error?: string }`

### Invariants That Must Remain True

- [x] File follows project naming convention (camelCase)
- [x] Uses `#privateField` syntax for private properties
- [x] Uses JSDoc type annotations
- [x] No direct console logging (uses logger)
- [x] File size under 500 lines

## Dependencies

- **Depends on**: UNWITEOPE-001 (schema must exist for validation)
- **Blocked by**: UNWITEOPE-001
- **Blocks**: UNWITEOPE-003 (DI registration needs handler class)

## Reference Files

| File                                                       | Purpose                                |
| ---------------------------------------------------------- | -------------------------------------- |
| `src/logic/operationHandlers/unlockGrabbingHandler.js`     | Similar appendage manipulation         |
| `src/logic/operationHandlers/dropItemAtLocationHandler.js` | Similar item operation pattern         |
| `src/utils/grabbingUtils.js`                               | `unlockAppendagesHoldingItem` function |
| `src/utils/cloneUtils.js`                                  | `deepClone` function                   |
| `src/utils/safeDispatchErrorUtils.js`                      | Error dispatch pattern                 |

---

## Outcome

### Completion Date

2025-11-27

### Implementation Summary

Successfully created `UnwieldItemHandler` at `src/logic/operationHandlers/unwieldItemHandler.js` following the `DropItemAtLocationHandler` pattern. The handler:

1. **Validates parameters** using `assertParamsObject` and `validateStringParam` utilities
2. **Implements idempotent behavior** - returns success silently when item is not wielded
3. **Releases grabbing appendages** via `unlockAppendagesHoldingItem` from grabbingUtils
4. **Updates wielding component** - removes item from `wielded_item_ids` array, or removes component entirely if no items remain
5. **Dispatches `items:item_unwielded` event** with actor, item, and remaining wielded items

### Validation Results

- **TypeScript**: ✅ No errors for `unwieldItemHandler.js`
- **ESLint**: ✅ Only expected warnings for hardcoded mod references (consistent with other handlers)

### Assumption Corrections Applied

Five original ticket assumptions were corrected before implementation to match actual codebase patterns:

- Parameter names: `actorEntity`/`itemEntity` (not `actor_id`/`item_id`)
- API: `getComponentData()` (not `getComponent()`)
- API: `addComponent()` for upsert (no `updateComponent()`)
- Return type: `{ success, error? }` (not `{ success, wasWielding }`)
- Constructor pattern: `super(name, deps)` validation pattern

### Next Steps

- UNWITEOPE-003: DI registration (now unblocked)
- UNWITEOPE-004: Unit tests
- UNWITEOPE-005, UNWITEOPE-006: Rule file modifications
- UNWITEOPE-007: Integration tests
