# UNWITEOPE-002 Assumptions Validation Report

## Summary
Comprehensive validation of 8 key assumptions for the UnwieldItemHandler ticket. Found **2 SIGNIFICANT DISCREPANCIES** and several clarifications needed.

---

## Assumption 1: BaseOperationHandler ✅ VERIFIED
**Status**: Exists and properly structured
- **File**: `src/logic/operationHandlers/baseOperationHandler.js`
- **Class**: Exported as named class `BaseOperationHandler`
- **Constructor**: Takes dependency object with `logger` property
- **Methods**: 
  - `deps()` - getter for dependencies
  - `logger()` - getter for logger
  - `getLogger(executionContext)` - method to extract logger from context
- **Pattern**: Extends/inherits from this base class as expected

---

## Assumption 2: grabbingUtils - unlockAppendagesHoldingItem ✅ VERIFIED
**Status**: Exists with correct signature
- **File**: `src/utils/grabbingUtils.js`
- **Function Signature**: 
  ```javascript
  export async function unlockAppendagesHoldingItem(
    entityManager,
    entityId,
    itemId
  )
  ```
- **Returns**: `{ success: true, unlockedParts }` or `{ success: false, unlockedParts: [] }`
- **Behavior**: 
  - Gracefully handles null/undefined parameters by returning failure
  - Uses `cloneComponent()` to update components (NOT deepClone)
  - Updates `anatomy:can_grab` component on each appendage
  - Uses `entityManager.addComponent()` to persist changes (async)
  - Filters appendages by checking `heldItemId === itemId`

**DISCREPANCY**: The function uses `cloneComponent()` not `deepClone()` - this is a minor detail but important if the ticket assumes deepClone

---

## Assumption 3: cloneUtils - deepClone ✅ VERIFIED
**Status**: Exists and available
- **File**: `src/utils/cloneUtils.js`
- **Function**: `deepClone()` - lines 45-55
- **Available for use**: Yes, but see Assumption 2 note

---

## Assumption 4: safeDispatchErrorUtils - safeDispatchError ⚠️ VERIFIED WITH IMPORTANT DETAILS
**Status**: Exists with important behavioral notes
- **File**: `src/utils/safeDispatchErrorUtils.js`
- **Function Signature**: 
  ```javascript
  export async function safeDispatchError(
    dispatcher,
    messageOrContext,  // Can be string OR ActionErrorContext object
    details,           // Optional - preserved explicitly, NOT defaulted
    logger
  )
  ```
- **Returns**: `boolean` (true if dispatched, false if dispatch failed)
- **Important Behavior**:
  - **ASYNC** - must be awaited or handled as Promise
  - Accepts either a message string OR an ActionErrorContext object
  - Second parameter has dual purpose (detection logic included)
  - If ActionErrorContext, extracts `error.message` and builds event details
  - Preserves `null` explicitly for details parameter (doesn't default to {})
  - Dispatches event with ID `SYSTEM_ERROR_OCCURRED_ID` (constant)
  - Returns `false` on dispatch failure (logs warning, doesn't throw)

**REFERENCE HANDLERS DON'T AWAIT**: Looking at `UnlockGrabbingHandler.execute()`, it calls:
```javascript
safeDispatchError(
  this.#dispatcher,
  `UNLOCK_GRABBING: failed to unlock...`,
  { ... },
  logger
);
```
**WITHOUT `await`** - This is async but not awaited in reference handlers!

---

## Assumption 5: Reference Handlers Pattern ✅ VERIFIED
**Status**: Both handlers follow consistent pattern
- **UnlockGrabbingHandler**: Lines 108-139
  - Constructor: Takes `{ logger, entityManager, dispatcher }`
  - Execute method: Parameters are `(params, executionContext)`
  - Uses `this.getLogger(executionContext)` from base class
  - Validates params with private `#validateParams()`
  - Returns void (no return statement in handler)
  - Uses `safeDispatchError()` without await
  - Dispatches success event via `this.#dispatcher.dispatch(eventId, payload)`

- **DropItemAtLocationHandler**: Lines 95-246
  - **DIFFERENT PATTERN**: Returns `{ success: boolean, error?: string }`
  - Extensive logging with `[DROP_ITEM]` prefixes
  - Uses `getLogger()` from base class
  - `addComponent()` and `removeComponent()` calls
  - Batch update pattern with `batchAddComponentsOptimized(updates, true)`
  - Has diagnostic/verification logging after operations

**IMPORTANT**: These handlers have DIFFERENT return patterns!
- UnlockGrabbingHandler: `async execute()` with no return
- DropItemAtLocationHandler: `async execute()` returns `{ success, error }`

---

## Assumption 6: positioning:wielding Component ✅ VERIFIED
**Status**: Component exists with correct structure
- **File**: `data/mods/positioning/components/wielding.component.json`
- **Field Name**: `wielded_item_ids` ✅ (CONFIRMED - NOT `wielded_items`)
- **Type**: Array of namespaced IDs
- **Properties**:
  - `wielded_item_ids`: string array, uniqueItems: true, default: []
  - `activityMetadata`: Metadata for activity description generation
    - `shouldDescribeInActivity`: boolean (default: true)
    - `template`: string with {targets} placeholder
    - `targetRole`: "wielded_item_ids"
    - `targetRoleIsArray`: true
    - `priority`: 70 (active combat stance)

---

## Assumption 7: Event ID Pattern ❌ DISCREPANCY FOUND
**Status**: Event ID NOT found in codebase
- **Searched for**: `items:item_unwielded` - **NOT FOUND**
- **Searched in**: All `src/` files with pattern matching
- **Similar events found** (pattern analysis):
  - `items:item_picked_up` (PickUpItemFromLocationHandler)
  - `items:item_dropped` (DropItemAtLocationHandler)
  - `items:item_transferred` (TransferItemHandler)
  - `items:item_put_in_container` (PutInContainerHandler)
  - `items:item_taken_from_container` (TakeFromContainerHandler)
  - `items:item_consumed` (ConsumeItemHandler - actually `metabolism:item_consumed`)

**PROBLEM**: The ticket assumes `items:item_unwielded` but:
1. No handler currently uses this event ID
2. Pattern suggests it should be `positioning:item_unwielded` or similar
3. No schema or component definitions reference this event

**REQUIRED**: Need to verify correct event ID or create it

---

## Assumption 8: EntityManager Methods ✅ VERIFIED (PARTIAL)
**Status**: Key methods exist, but important method MISSING
- **Available Methods**:
  - ✅ `getComponentData(instanceId, componentTypeId)` - line 534
  - ✅ `removeComponent(instanceId, componentTypeId)` - line 480
  - ✅ `addComponent(instanceId, componentTypeId, componentData)` - line 462
  - ✅ `batchAddComponentsOptimized(updates, atomically)` - line 492
  - ✅ `getComponent(instanceId, componentTypeId)` - line 544
  - ✅ `hasComponent(instanceId, componentTypeId)` - line 557

- **NOT AVAILABLE**:
  - ❌ `updateComponent()` - **DOES NOT EXIST**
  - Instead: Use `addComponent()` (which upserts/overwrites)

**DISCREPANCY**: The ticket may assume `updateComponent()` exists, but the actual pattern is:
1. Get component data: `getComponentData()`
2. Modify the data object
3. Add/overwrite with: `addComponent()` or in batch with `batchAddComponentsOptimized()`

---

## Summary of Discrepancies

### Critical Issues:
1. **Event ID Missing**: `items:item_unwielded` not found in codebase
   - Need to determine correct event ID or create it
   - Suggest: `positioning:item_unwielded` (matches component namespace)

2. **No updateComponent() Method**: EntityManager lacks this method
   - Use `addComponent()` instead (upserts)
   - Or use batch update: `batchAddComponentsOptimized()`

### Minor Issues:
3. **grabbingUtils uses cloneComponent**: Not deepClone as ticket might assume
   - Not a blocker, just a note

4. **safeDispatchError is async**: Reference handlers don't await it
   - Consistent with existing pattern (UnlockGrabbingHandler)
   - Safe to leave unawaited (errors are caught and logged internally)

5. **Return Pattern Inconsistency**: Reference handlers differ
   - UnlockGrabbingHandler: No return
   - DropItemAtLocationHandler: Returns `{ success, error }`
   - Need to decide which pattern to follow

---

## Recommended Corrections for Ticket

1. **Define event ID**: Create `positioning:item_unwielded` event (or clarify which ID to use)
2. **Clarify return behavior**: Should UnwieldItemHandler return `{ success, error }` or void?
3. **Use addComponent() for updates**: Not `updateComponent()` which doesn't exist
4. **Match safeDispatchError usage**: Don't await (following UnlockGrabbingHandler pattern)
5. **Consider batch updates**: For atomicity if updating multiple components

---

## Code Patterns to Follow (Confirmed)

Based on reference handlers, UnwieldItemHandler should:

```javascript
class UnwieldItemHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UnwieldItemHandler', { ... });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);
    const validated = this.#validateParams(params, log);
    if (!validated) return; // Or return { success: false, error: '...' }

    try {
      // Use getComponentData, addComponent, removeComponent
      // Don't await safeDispatchError
      // Dispatch event via this.#dispatcher.dispatch(EVENT_ID, payload)
    } catch (err) {
      safeDispatchError(this.#dispatcher, 'MESSAGE', { ... }, log);
    }
  }

  #validateParams(params, logger) { ... }
}
```

---

## Files Verified
- ✅ src/logic/operationHandlers/baseOperationHandler.js
- ✅ src/utils/grabbingUtils.js
- ✅ src/utils/cloneUtils.js
- ✅ src/utils/safeDispatchErrorUtils.js
- ✅ src/logic/operationHandlers/unlockGrabbingHandler.js
- ✅ src/logic/operationHandlers/dropItemAtLocationHandler.js
- ✅ src/entities/entityManager.js
- ✅ data/mods/positioning/components/wielding.component.json
- ✅ data/schemas/operations/unwieldItem.schema.json

---

## Conclusion

**Overall Assessment**: Most assumptions are CORRECT, but **2 CRITICAL CLARIFICATIONS NEEDED**:
1. Event ID definition
2. Return value pattern (void vs { success, error })

All utility functions exist and have correct signatures. The wielding component structure matches expectations. The main work is implementing the handler logic correctly following the established patterns in reference handlers.
