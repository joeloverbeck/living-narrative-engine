# OPEHANARCANA-020: Migrate items Mod Inventory Rules

**Status:** Ready
**Priority:** Medium (Phase 3 Migration)
**Estimated Effort:** 1 day
**Dependencies:** OPEHANARCANA-017, OPEHANARCANA-018, OPEHANARCANA-019 (VALIDATED_ITEM_TRANSFER complete)

---

## Objective

Migrate the 4 inventory validation rules in the `items` mod from the expanded pattern (~180 lines each) to use `VALIDATED_ITEM_TRANSFER`, reducing each rule to ~15 lines (92% reduction).

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/items/rules/handle_give_item.rule.json`
- `data/mods/items/rules/handle_pick_up_item.rule.json`
- `data/mods/containers/rules/handle_put_in_container.rule.json`
- `data/mods/containers/rules/handle_take_from_container.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Other items mod rules (handle*drop_item, handle_examine*_, handle*drink*_, etc.)
- Rules in other mods
- The VALIDATED_ITEM_TRANSFER handler itself
- Any DI or schema files

---

## Migration Patterns

### 1. handle_give_item.rule.json

**Before (~180 lines)**

```json
{
  "actions": [
    // VALIDATE_INVENTORY_CAPACITY
    // IF (capacity exceeded) → DISPATCH failure event → END_TURN
    // TRANSFER_ITEM
    // GET_NAME (actor)
    // GET_NAME (target)
    // GET_NAME (item)
    // SET_VARIABLE (x3)
    // DISPATCH_PERCEPTIBLE_EVENT
    // macro: core:logSuccessAndEndTurn
  ]
}
```

**After (~15 lines)**

```json
{
  "id": "items:handle_give_item",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "items:event-is-action-give-item" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "VALIDATED_ITEM_TRANSFER",
      "parameters": {
        "from_entity_ref": "actor",
        "to_entity_ref": "target",
        "item_entity_ref": "item",
        "validation_type": "inventory",
        "transfer_type": "inventory_to_inventory",
        "success_message_template": "{actorName} gives {itemName} to {targetName}.",
        "failure_message_template": "{targetName}'s inventory is full. Cannot give {itemName}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### 2. handle_pick_up_item.rule.json

**After (~15 lines)**

```json
{
  "id": "items:handle_pick_up_item",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "items:event-is-action-pick-up-item" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "VALIDATED_ITEM_TRANSFER",
      "parameters": {
        "from_entity_ref": "location",
        "to_entity_ref": "actor",
        "item_entity_ref": "target",
        "validation_type": "inventory",
        "transfer_type": "location_to_inventory",
        "success_message_template": "{actorName} picks up {itemName}.",
        "failure_message_template": "{actorName}'s inventory is full. Cannot pick up {itemName}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### 3. handle_put_in_container.rule.json

**After (~15 lines)**

```json
{
  "id": "items:handle_put_in_container",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "items:event-is-action-put-in-container" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "VALIDATED_ITEM_TRANSFER",
      "parameters": {
        "from_entity_ref": "actor",
        "to_entity_ref": "target",
        "item_entity_ref": "secondary",
        "validation_type": "container",
        "transfer_type": "inventory_to_container",
        "success_message_template": "{actorName} puts {itemName} in {targetName}.",
        "failure_message_template": "{targetName} is full. Cannot put {itemName} in it."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### 4. handle_take_from_container.rule.json

**After (~15 lines)**

```json
{
  "id": "items:handle_take_from_container",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "items:event-is-action-take-from-container" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "VALIDATED_ITEM_TRANSFER",
      "parameters": {
        "from_entity_ref": "target",
        "to_entity_ref": "actor",
        "item_entity_ref": "secondary",
        "validation_type": "inventory",
        "transfer_type": "container_to_inventory",
        "success_message_template": "{actorName} takes {itemName} from {targetName}.",
        "failure_message_template": "{actorName}'s inventory is full. Cannot take {itemName}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist

- [ ] `handle_give_item.rule.json` → VALIDATED_ITEM_TRANSFER (inventory_to_inventory)
- [ ] `handle_pick_up_item.rule.json` → VALIDATED_ITEM_TRANSFER (location_to_inventory)
- [ ] `handle_put_in_container.rule.json` → VALIDATED_ITEM_TRANSFER (inventory_to_container)
- [ ] `handle_take_from_container.rule.json` → VALIDATED_ITEM_TRANSFER (container_to_inventory)
- [ ] Validate JSON syntax for all modified rules
- [ ] Run items mod integration tests

---

## Acceptance Criteria

### Tests That Must Pass

1. **All items mod integration tests:**

   ```bash
   npm run test:integration -- tests/integration/mods/items/
   ```

2. **Mod validation:**

   ```bash
   npm run validate:mod:items
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All 4 rules produce **identical runtime behavior** to before
2. Inventory capacity validation still occurs
3. Container capacity validation still occurs
4. Failure events are still dispatched when validation fails
5. Success events are dispatched on successful transfer
6. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. Validate JSON syntax
for file in data/mods/items/rules/handle_{give_item,pick_up_item,put_in_container,take_from_container}.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod:items

# 3. Run items-specific integration tests
npm run test:integration -- tests/integration/mods/items/ --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Testing Scenarios

Verify the following scenarios work correctly:

### Give Item

1. **Actor gives item to target with space** → Transfer succeeds, success message
2. **Actor gives item to target without space** → Transfer fails, failure message, item stays with actor

### Pick Up Item

1. **Actor picks up item with inventory space** → Transfer succeeds
2. **Actor picks up item without space** → Transfer fails, item stays on ground

### Container Operations

1. **Put item in container with space** → Transfer succeeds
2. **Put item in full container** → Transfer fails, item stays in inventory
3. **Take item from container with space** → Transfer succeeds
4. **Take item from container without space** → Transfer fails, item stays in container

---

## Reference Files

- Original rules: `data/mods/items/rules/*.rule.json`
- Handler: `src/logic/operationHandlers/validatedItemTransferHandler.js`
- Schema: `data/schemas/operations/validatedItemTransfer.schema.json`
