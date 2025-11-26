# UNWITEOPE-005: Update handle_drop_item.rule.json

## Summary

Add the `UNWIELD_ITEM` operation to the drop item rule, ensuring wielded items are properly unwielded before being dropped.

## Files to Modify

| File | Change |
|------|--------|
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
    "actor_id": "{event.payload.actorId}",
    "item_id": "{event.payload.targetId}"
  }
}
```

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

1. [ ] `UNWIELD_ITEM` operation added at correct position (after QUERY_COMPONENT, before DROP_ITEM_AT_LOCATION)
2. [ ] Parameters use correct event payload references
3. [ ] Comment clearly explains purpose and idempotent nature
4. [ ] JSON syntax is valid
5. [ ] Rule continues to pass schema validation
6. [ ] Existing operations unchanged

### Invariants That Must Remain True

- [ ] Rule schema validation passes
- [ ] All existing operations remain unchanged
- [ ] Parameter references match event payload structure
- [ ] Operation type matches `'UNWIELD_ITEM'` exactly
- [ ] No modifications to files outside the file list
- [ ] `npm run validate` passes
- [ ] `npm run test:ci` passes

## Dependencies

- **Depends on**: UNWITEOPE-001 (schema), UNWITEOPE-002 (handler), UNWITEOPE-003 (DI registration)
- **Blocked by**: UNWITEOPE-003
- **Blocks**: UNWITEOPE-007 (integration tests need both rules updated)

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/items/rules/handle_unwield_item.rule.json` | Related rule being simplified |
| `data/mods/items/rules/handle_give_item.rule.json` | Similar item operation rule |
| `data/schemas/operations/unwieldItem.schema.json` | Operation schema definition |

## Testing Scenarios

After this change, the following scenarios should work:

| Scenario | Expected Behavior |
|----------|-------------------|
| Drop non-wielded item | UNWIELD_ITEM returns success (no-op), item dropped normally |
| Drop wielded item | UNWIELD_ITEM unwields first, then item dropped |
| Drop two-handed wielded item | UNWIELD_ITEM releases both hands, item dropped |
