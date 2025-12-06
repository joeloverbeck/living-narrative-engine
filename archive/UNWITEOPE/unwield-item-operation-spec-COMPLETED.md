# Unwield Item Operation Specification

## Status: IMPLEMENTED

## Overview

This specification documents the `UNWIELD_ITEM` operation handler, which encapsulates all logic for stopping wielding an item, including releasing grabbing appendages and cleaning up the wielding component.

## Problem Statement

When dropping a wielded item via `drop_item.action.json`, the system currently:

- Removes the item from inventory
- Sets the item's position to the actor's location

However, it does NOT:

- Remove the item from `wielded_item_ids` in `positioning:wielding` component
- Unlock the grabbing appendages holding the item
- Clean up the wielding component if it becomes empty
- Regenerate the actor's description

This leaves the actor in an inconsistent state where they appear to still be wielding a dropped item.

## Solution

Create a new `UNWIELD_ITEM` operation handler that:

1. Encapsulates all unwielding logic in a single, reusable operation
2. Is idempotent - safe to call even if item is not currently wielded
3. Can be used by both `handle_unwield_item.rule.json` and `handle_drop_item.rule.json`
4. Eliminates code duplication between rules

## Schema Definition

**File**: `data/schemas/operations/unwieldItem.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/unwieldItem.schema.json",
  "title": "UNWIELD_ITEM Operation",
  "description": "Stops wielding an item, releasing grabbing appendages and updating the wielding component. Idempotent - succeeds silently if item is not currently wielded.",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UNWIELD_ITEM" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "actorEntity": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the actor currently wielding the item"
        },
        "itemEntity": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the item to stop wielding"
        }
      },
      "required": ["actorEntity", "itemEntity"],
      "additionalProperties": false
    }
  }
}
```

### Parameters

| Parameter     | Type   | Required | Description                                         |
| ------------- | ------ | -------- | --------------------------------------------------- |
| `actorEntity` | string | Yes      | Entity ID of the actor who may be wielding the item |
| `itemEntity`  | string | Yes      | Entity ID of the item to stop wielding              |

**Note**: Original spec used `actor_id` and `item_id`, but actual implementation uses `actorEntity` and `itemEntity` for consistency with other handlers.

## Handler Behavior

**File**: `src/logic/operationHandlers/unwieldItemHandler.js`

### Execution Flow

1. **Validate Parameters**
   - Verify `actorEntity` is a non-empty string
   - Verify `itemEntity` is a non-empty string
   - On validation failure, return `{ success: false, error: 'validation_failed' }`

2. **Check Wielding Component**
   - Get `positioning:wielding` component from actor
   - If component doesn't exist, return `{ success: true }` (idempotent)

3. **Check If Item Is Wielded**
   - Check if `itemEntity` is in `wielded_item_ids` array
   - If not found, return `{ success: true }` (idempotent)

4. **Unlock Grabbing Appendages**
   - Call `unlockAppendagesHoldingItem(entityManager, actorEntity, itemEntity)` from grabbingUtils
   - This unlocks ALL appendages holding the specific item

5. **Update Wielding Component**
   - Remove `itemEntity` from `wielded_item_ids` array
   - If array becomes empty, remove `positioning:wielding` component entirely
   - Otherwise, update component with remaining items

6. **Dispatch Event**
   - Dispatch `items:item_unwielded` event with:
     - `actorEntity`: The actor who stopped wielding
     - `itemEntity`: The item that was unwielded
     - `remainingWieldedItems`: Array of items still being wielded

7. **Return Result**
   - Return `{ success: true }`

### Idempotent Design

The handler is designed to be idempotent, meaning it can be safely called multiple times or when the item isn't being wielded:

| Scenario                        | Behavior                               |
| ------------------------------- | -------------------------------------- |
| Actor has no wielding component | Returns success (no-op)                |
| Item not in wielded_item_ids    | Returns success (no-op)                |
| wielded_item_ids is empty array | Returns success (no-op)                |
| wielded_item_ids is undefined   | Returns success (no-op)                |
| Item is wielded                 | Performs full unwield, returns success |

This allows rules to unconditionally call `UNWIELD_ITEM` without complex conditional logic.

## Rule Usage

### handle_drop_item.rule.json

Add `UNWIELD_ITEM` operation **before** `DROP_ITEM_AT_LOCATION`:

```json
{
  "type": "UNWIELD_ITEM",
  "comment": "If item is wielded, unwield it first (idempotent)",
  "parameters": {
    "actorEntity": "{event.payload.actorId}",
    "itemEntity": "{event.payload.targetId}"
  }
}
```

### handle_unwield_item.rule.json

Uses `UNWIELD_ITEM` to encapsulate the unwielding logic:

```json
{
  "type": "UNWIELD_ITEM",
  "comment": "Stop wielding the item, releasing appendages and cleaning up wielding state",
  "parameters": {
    "actorEntity": "{event.payload.actorId}",
    "itemEntity": "{event.payload.targetId}"
  }
}
```

## Dependencies

### Existing Utilities Used

- `unlockAppendagesHoldingItem()` from `src/utils/grabbingUtils.js`

### Components Accessed

- `positioning:wielding` - Actor's wielding state

## DI Registration

### Token

**File**: `src/dependencyInjection/tokens/tokens-core.js`

```javascript
UnwieldItemHandler: 'UnwieldItemHandler',
```

### Factory Registration

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

```javascript
[
  tokens.UnwieldItemHandler,
  UnwieldItemHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    }),
],
```

### Interpreter Mapping

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

```javascript
registry.register('UNWIELD_ITEM', bind(tokens.UnwieldItemHandler));
```

### Pre-validation Whitelist

**File**: `src/utils/preValidationUtils.js`

```javascript
// Add to KNOWN_OPERATION_TYPES array (alphabetically)
'UNWIELD_ITEM',
```

## Event Dispatched

**Event Type**: `items:item_unwielded`

**Payload**:

```javascript
{
  actorEntity: string,       // Entity ID of the actor
  itemEntity: string,        // Entity ID of the unwielded item
  remainingWieldedItems: string[]  // IDs of items still being wielded
}
```

## Files Summary

### Files Created

| File                                                            | Purpose                |
| --------------------------------------------------------------- | ---------------------- |
| `data/schemas/operations/unwieldItem.schema.json`               | Operation schema       |
| `src/logic/operationHandlers/unwieldItemHandler.js`             | Handler implementation |
| `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js` | Unit tests             |

### Files Modified

| File                                                                     | Change                       |
| ------------------------------------------------------------------------ | ---------------------------- |
| `data/schemas/operation.schema.json`                                     | Add schema $ref              |
| `src/dependencyInjection/tokens/tokens-core.js`                          | Add token                    |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add factory                  |
| `src/dependencyInjection/registrations/interpreterRegistrations.js`      | Add mapping                  |
| `src/utils/preValidationUtils.js`                                        | Add to whitelist             |
| `data/mods/items/rules/handle_drop_item.rule.json`                       | Add UNWIELD_ITEM call        |
| `data/mods/items/rules/handle_unwield_item.rule.json`                    | Simplify using new operation |

## Future Considerations

This operation can be reused for other actions that need to release wielded items:

- `give_item` - When giving a wielded item to another actor
- `put_in_container` - When putting a wielded item in a container
- Any future action that transfers a wielded item

---

## Outcome

### Spec vs Implementation Differences

| Spec Element                                          | Actual Implementation                                   |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Parameter names: `actor_id`, `item_id`                | Uses `actorEntity`, `itemEntity`                        |
| Event payload: `actorId`, `itemId`                    | Uses `actorEntity`, `itemEntity`                        |
| Returns `{ success: true, wasWielding: boolean }`     | Returns `{ success: true }` (no wasWielding field)      |
| Integration test file: `unwieldItemOperation.test.js` | Tests in existing `unwield_item_rule_execution.test.js` |

### Implementation Status

- ✅ Schema created and registered
- ✅ Handler implemented with idempotent behavior
- ✅ DI registration complete (token, factory, mapping, whitelist)
- ✅ Unit tests passing (33 tests)
- ✅ Integration tests passing (9 tests + 3 drop wielded item tests)
- ✅ Rules updated to use new operation
