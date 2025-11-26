# Unwield Item Operation Specification

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
        "actor_id": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the actor currently wielding the item"
        },
        "item_id": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the item to stop wielding"
        }
      },
      "required": ["actor_id", "item_id"],
      "additionalProperties": false
    }
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `actor_id` | string | Yes | Entity ID of the actor who may be wielding the item |
| `item_id` | string | Yes | Entity ID of the item to stop wielding |

## Handler Behavior

**File**: `src/logic/operationHandlers/unwieldItemHandler.js`

### Execution Flow

1. **Validate Parameters**
   - Verify `actor_id` is a non-empty string
   - Verify `item_id` is a non-empty string
   - On validation failure, dispatch error and return `{ success: false }`

2. **Check Wielding Component**
   - Get `positioning:wielding` component from actor
   - If component doesn't exist, return `{ success: true, wasWielding: false }` (idempotent)

3. **Check If Item Is Wielded**
   - Check if `item_id` is in `wielded_item_ids` array
   - If not found, return `{ success: true, wasWielding: false }` (idempotent)

4. **Get Grabbing Requirements**
   - Get `anatomy:requires_grabbing` component from item
   - Use `handsRequired` value (default: 1 if component missing)

5. **Unlock Grabbing Appendages**
   - Call `unlockAppendagesHoldingItem(entityManager, actorId, itemId)` from grabbingUtils
   - This unlocks ALL appendages holding the specific item

6. **Update Wielding Component**
   - Remove `item_id` from `wielded_item_ids` array
   - If array becomes empty, remove `positioning:wielding` component entirely
   - Otherwise, update component with remaining items

7. **Dispatch Event**
   - Dispatch `items:item_unwielded` event with:
     - `actorId`: The actor who stopped wielding
     - `itemId`: The item that was unwielded
     - `remainingWieldedItems`: Array of items still being wielded

8. **Return Result**
   - Return `{ success: true, wasWielding: true }`

### Idempotent Design

The handler is designed to be idempotent, meaning it can be safely called multiple times or when the item isn't being wielded:

| Scenario | Behavior |
|----------|----------|
| Actor has no wielding component | Returns success (no-op) |
| Item not in wielded_item_ids | Returns success (no-op) |
| Item is wielded | Performs full unwield, returns success |

This allows rules to unconditionally call `UNWIELD_ITEM` without complex conditional logic.

## Rule Changes

### handle_drop_item.rule.json

Add `UNWIELD_ITEM` operation **before** `DROP_ITEM_AT_LOCATION`:

```json
{
  "type": "UNWIELD_ITEM",
  "comment": "If item is wielded, unwield it first (idempotent)",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "item_id": "{event.payload.targetId}"
  }
}
```

### handle_unwield_item.rule.json

Replace the 5 discrete operations (QUERY_COMPONENT for grabbing reqs, UNLOCK_GRABBING, MODIFY_ARRAY_FIELD, QUERY_COMPONENT for wielding, IF/REMOVE_COMPONENT) with a single operation:

```json
{
  "type": "UNWIELD_ITEM",
  "comment": "Stop wielding the item, releasing appendages and cleaning up wielding state",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "item_id": "{event.payload.targetId}"
  }
}
```

Keep: GET_NAME operations, SET_VARIABLE operations, REGENERATE_DESCRIPTION, and the logging macro.

## Dependencies

### Existing Utilities Used

- `unlockAppendagesHoldingItem()` from `src/utils/grabbingUtils.js`
- `deepClone()` from `src/utils/cloneUtils.js`
- `safeDispatchError()` from `src/utils/safeDispatchErrorUtils.js`

### Components Accessed

- `positioning:wielding` - Actor's wielding state
- `anatomy:requires_grabbing` - Item's grabbing requirements (optional, defaults to 1)

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

## Testing Requirements

### Unit Tests

**File**: `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js`

| Test Case | Description |
|-----------|-------------|
| Invalid actor_id | Returns validation error |
| Invalid item_id | Returns validation error |
| No wielding component | Returns success with wasWielding: false |
| Item not in wielded_item_ids | Returns success with wasWielding: false |
| Single wielded item | Removes component, unlocks appendages |
| Multiple wielded items | Removes item from array, keeps component |
| Two-handed weapon | Unlocks correct number of appendages |

### Integration Tests

**File**: `tests/integration/mods/items/unwieldItemOperation.test.js`

| Test Case | Description |
|-----------|-------------|
| Full unwield flow | Verify complete rule execution |
| Drop wielded item | Verify drop_item unwields first |
| Drop non-wielded item | Verify normal drop behavior unchanged |

## Event Dispatched

**Event Type**: `items:item_unwielded`

**Payload**:
```javascript
{
  actorId: string,       // Entity ID of the actor
  itemId: string,        // Entity ID of the unwielded item
  remainingWieldedItems: string[]  // IDs of items still being wielded
}
```

## Files Summary

### Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/unwieldItem.schema.json` | Operation schema |
| `src/logic/operationHandlers/unwieldItemHandler.js` | Handler implementation |
| `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js` | Unit tests |
| `tests/integration/mods/items/unwieldItemOperation.test.js` | Integration tests |

### Files to Modify

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add schema $ref |
| `src/dependencyInjection/tokens/tokens-core.js` | Add token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Add mapping |
| `src/utils/preValidationUtils.js` | Add to whitelist |
| `data/mods/items/rules/handle_drop_item.rule.json` | Add UNWIELD_ITEM call |
| `data/mods/items/rules/handle_unwield_item.rule.json` | Simplify using new operation |

## Future Considerations

This operation can be reused for other actions that need to release wielded items:
- `give_item` - When giving a wielded item to another actor
- `put_in_container` - When putting a wielded item in a container
- Any future action that transfers a wielded item
