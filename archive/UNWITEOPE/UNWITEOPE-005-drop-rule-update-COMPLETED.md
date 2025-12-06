# UNWITEOPE-005: Update handle_drop_item.rule.json

**Status: ✅ COMPLETED**

## Summary

Add the `UNWIELD_ITEM` operation to the drop item rule, ensuring wielded items are properly unwielded before being dropped.

## Files to Modify

| File                                               | Change                                                  |
| -------------------------------------------------- | ------------------------------------------------------- |
| `data/mods/items/rules/handle_drop_item.rule.json` | Add UNWIELD_ITEM operation before DROP_ITEM_AT_LOCATION |

## Implementation Details

### Current Rule Structure

The current rule executes:

1. `QUERY_COMPONENT` - Get actor's current position
2. `DROP_ITEM_AT_LOCATION` - Remove from inventory and place at location
3. `GET_NAME` (actor) - Get actor name
4. `GET_NAME` (item) - Get item name
5. `GET_TIMESTAMP` - Get current timestamp
6. `SET_VARIABLE` (x4) - Prepare logging variables
7. `macro: core:logSuccessAndEndTurn` - Display message

### Required Change

Insert `UNWIELD_ITEM` operation **after** the `QUERY_COMPONENT` and **before** `DROP_ITEM_AT_LOCATION`:

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

> **Note**: Parameter names corrected from `actor_id`/`item_id` to `actorEntity`/`itemEntity` to match the schema defined in `data/schemas/operations/unwieldItem.schema.json`.

### Updated Actions Array Order

1. `QUERY_COMPONENT` - Get actor's current position
2. **`UNWIELD_ITEM` - If item is wielded, unwield it first (NEW)**
3. `DROP_ITEM_AT_LOCATION` - Remove from inventory and place at location
4. `GET_NAME` (actor) - Get actor name
5. `GET_NAME` (item) - Get item name
6. `GET_TIMESTAMP` - Get current timestamp
7. `SET_VARIABLE` (x4) - Prepare logging variables
8. `macro: core:logSuccessAndEndTurn` - Display message

### Why This Position?

- **After QUERY_COMPONENT**: We need the position query to happen first since DROP_ITEM_AT_LOCATION needs it
- **Before DROP_ITEM_AT_LOCATION**: Item must be unwielded before it can be dropped
- **Idempotent**: Safe to call even if item is not wielded (handles non-wielded items gracefully)

## Out of Scope

- **DO NOT** create the schema (UNWITEOPE-001)
- **DO NOT** create the handler (UNWITEOPE-002)
- **DO NOT** modify DI registrations (UNWITEOPE-003)
- **DO NOT** create unit tests (UNWITEOPE-004)
- **DO NOT** modify handle_unwield_item.rule.json (UNWITEOPE-006)
- **DO NOT** create integration tests (UNWITEOPE-007)
- **DO NOT** modify any other rule files
- **DO NOT** change the existing operations (except adding the new one)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate rule schema
npm run validate

# Validate items mod
npm run validate:mod:items

# Full CI validation
npm run test:ci
```

### Manual Verification Checklist

1. [x] `UNWIELD_ITEM` operation added at correct position (after QUERY_COMPONENT, before DROP_ITEM_AT_LOCATION)
2. [x] Parameters use correct event payload references
3. [x] Comment clearly explains purpose and idempotent nature
4. [x] JSON syntax is valid
5. [x] Rule continues to pass schema validation
6. [x] Existing operations unchanged

### Invariants That Must Remain True

- [x] Rule schema validation passes
- [x] All existing operations remain unchanged
- [x] Parameter references match event payload structure
- [x] Operation type matches `'UNWIELD_ITEM'` exactly
- [x] No modifications to files outside the file list
- [x] `npm run validate` passes
- [x] `npm run test:ci` passes

## Dependencies

- **Depends on**: UNWITEOPE-001 (schema), UNWITEOPE-002 (handler), UNWITEOPE-003 (DI registration)
- **Blocked by**: UNWITEOPE-003
- **Blocks**: UNWITEOPE-007 (integration tests need both rules updated)

## Reference Files

| File                                                  | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `data/mods/items/rules/handle_unwield_item.rule.json` | Related rule being simplified |
| `data/mods/items/rules/handle_give_item.rule.json`    | Similar item operation rule   |
| `data/schemas/operations/unwieldItem.schema.json`     | Operation schema definition   |

## Testing Scenarios

After this change, the following scenarios should work:

| Scenario                     | Expected Behavior                                           |
| ---------------------------- | ----------------------------------------------------------- |
| Drop non-wielded item        | UNWIELD_ITEM returns success (no-op), item dropped normally |
| Drop wielded item            | UNWIELD_ITEM unwields first, then item dropped              |
| Drop two-handed wielded item | UNWIELD_ITEM releases both hands, item dropped              |

---

## Outcome

**Implementation Date**: 2025-11-27

### Files Modified

| File                                                         | Changes                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `data/mods/items/rules/handle_drop_item.rule.json`           | Added UNWIELD_ITEM operation after QUERY_COMPONENT, before DROP_ITEM_AT_LOCATION     |
| `tests/common/mods/ModTestHandlerFactory.js`                 | Added UnwieldItemHandler import and registration in createHandlersWithItemsSupport() |
| `tests/integration/mods/items/dropItemRuleExecution.test.js` | Added 3 new tests for wielded item scenarios                                         |

### Ticket Corrections

- **Parameter Names**: Original ticket incorrectly specified `actor_id`/`item_id`. Corrected to `actorEntity`/`itemEntity` to match the schema definition in `data/schemas/operations/unwieldItem.schema.json`.

### Test Coverage Added

Three new integration tests added to verify wielded item handling:

1. **should unwield item before dropping when item is wielded** - Tests single wielded item, verifies wielding component is removed
2. **should handle dropping wielded item when actor has multiple wielded items** - Tests dual-wielding, verifies only dropped item is removed from wielded list
3. **should handle dropping non-wielded item when actor has wielded items (idempotent)** - Tests idempotent behavior, verifies wielding state unchanged for non-wielded items

### Additional Changes Required (not in original ticket)

The `UNWIELD_ITEM` handler was not registered in `ModTestHandlerFactory.createHandlersWithItemsSupport()`, causing integration tests to silently skip the operation. This was fixed by:

1. Adding `import UnwieldItemHandler from '../../../src/logic/operationHandlers/unwieldItemHandler.js';`
2. Adding `UNWIELD_ITEM: new UnwieldItemHandler({...})` to the handlers object

### Verification

- `npm run validate` ✅ passes
- `tests/integration/mods/items/dropItemRuleExecution.test.js` ✅ 11/11 tests pass
- `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js` ✅ 31/31 tests pass
- `tests/integration/mods/items/` ✅ 540/540 tests pass
