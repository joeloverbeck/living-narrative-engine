# DISPEREVEUPG-005: Item Transfer Rule - Perspective Upgrade + Macro Replacement

**Status:** Ready
**Priority:** Critical (Priority 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the `handle_give_item` rule to support perspective-aware perception with `actor_description`, `target_description`, and `alternate_descriptions`. This ticket also requires **replacing the macro** `core:logSuccessAndEndTurn` with inline operations for complete perspective support.

---

## Files to Touch

### Modified Files (1 rule)

- `data/mods/item-transfer/rules/handle_give_item.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in item-transfer mod
- Any condition files in item-transfer mod
- Any component files
- Any entity files
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)
- Test files (tests will verify behavior, not be modified)
- The macro definition itself (`core:logSuccessAndEndTurn`)

---

## Implementation Details

### Pattern: Actor-to-Actor Action (Full Perspective)

This rule involves actor giving item to target. Both are actors requiring full perspective support.

### Macro Replacement

**Current uses:** `{ "macro": "core:logSuccessAndEndTurn" }`

**Replace with inline operations:**
```json
[
  {
    "type": "DISPATCH_PERCEPTIBLE_EVENT",
    "parameters": {
      "location_id": "{context.actorPosition.locationId}",
      "description_text": "...",
      "actor_description": "...",
      "target_description": "...",
      "alternate_descriptions": {...},
      "perception_type": "action",
      "actor_id": "{event.payload.actorId}",
      "target_id": "{event.payload.primaryId}",
      "log_entry": true
    }
  },
  {
    "type": "DISPATCH_EVENT",
    "parameters": {
      "event_type": "TURN_ENDED",
      "payload": {
        "actorId": "{event.payload.actorId}"
      }
    }
  },
  { "type": "END_TURN" }
]
```

### handle_give_item.rule.json

**Current:** Uses macro for success path, potentially has DISPATCH_PERCEPTIBLE_EVENT for failure

**Upgrade SUCCESS path:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} gives {context.itemName} to {context.targetName}.",
    "actor_description": "I hand {context.itemName} to {context.targetName}.",
    "target_description": "{context.actorName} gives me {context.itemName}.",
    "perception_type": "action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.primaryId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear something being handed over nearby.",
      "tactile": "I sense an item being exchanged between people nearby."
    }
  }
}
```

**Upgrade FAILURE path (capacity exceeded):**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.targetName}'s inventory is full. {context.actorName} cannot give {context.itemName}.",
    "actor_description": "I try to give {context.itemName} to {context.targetName}, but their inventory is full.",
    "target_description": "{context.actorName} tries to give me {context.itemName}, but I cannot carry any more.",
    "perception_type": "action_failed",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.primaryId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear a failed attempt to transfer something."
    }
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Item transfer integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/item-transfer/ --no-coverage --silent
   ```

2. **Items mod integration tests (related functionality):**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --silent
   ```

3. **Mod validation:**
   ```bash
   npm run validate:mod:item-transfer
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing item transfer behavior is preserved
2. Items transfer correctly from actor inventory to target inventory
3. Inventory capacity validation still occurs before transfer
4. Failure path executes correctly when target inventory is full
5. TURN_ENDED event is dispatched after successful transfer
6. Events dispatch with correct payloads
7. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/item-transfer/rules/handle_give_item.rule.json'))" && echo "OK: handle_give_item"

# 2. Run mod validation
npm run validate:mod:item-transfer

# 3. Run item-transfer integration tests
NODE_ENV=test npx jest tests/integration/mods/item-transfer/ --no-coverage --verbose

# 4. Run items mod tests (related functionality)
NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --verbose

# 5. Run full test suite
npm run test:ci
```

---

## Testing Scenarios

Verify the following scenarios work correctly after changes:

### Give Item Success
1. Actor has item in inventory
2. Target has space in inventory
3. Item transfers successfully
4. Actor receives first-person confirmation
5. Target receives second-person notification
6. Observers receive third-person description
7. Turn ends correctly

### Give Item Failure (Capacity)
1. Actor has item in inventory
2. Target inventory is full
3. Transfer fails
4. Actor receives first-person failure message
5. Target receives second-person failure message
6. Item remains in actor inventory
7. Turn ends correctly

---

## Reference Files

- Pattern to follow: `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` (full actor/target/alternates per outcome)
- Macro being replaced: `data/mods/core/macros/logSuccessAndEndTurn.macro.json` (reference only)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
