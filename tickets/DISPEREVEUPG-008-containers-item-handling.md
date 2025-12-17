# DISPEREVEUPG-008: Containers, Item-Handling, Item-Placement - Perspective Upgrade + Bug Fix + Macro Replacement

**Status:** Ready
**Priority:** Moderate (Priority 3)
**Estimated Effort:** 1 day
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 6 container and item handling rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`. This ticket also includes:
1. **Bug fix**: Add missing `target_id` parameter in `handle_pick_up_item.rule.json`
2. **Macro replacement**: Replace `core:logSuccessAndEndTurn` macro with inline operations in 5 rules

---

## Files to Touch

### Modified Files (6 rules)

- `data/mods/containers/rules/handle_open_container.rule.json`
- `data/mods/containers/rules/handle_put_in_container.rule.json`
- `data/mods/containers/rules/handle_take_from_container.rule.json`
- `data/mods/item-handling/rules/handle_pick_up_item.rule.json`
- `data/mods/item-placement/rules/handle_put_on_nearby_surface.rule.json`
- `data/mods/item-placement/rules/handle_take_from_nearby_surface.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in these mods
- Any condition files in these mods
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

### Pattern: Object Interaction (Actor + Object)

All six rules involve actor interacting with objects (containers, items, surfaces). Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, tactile where appropriate)

No `target_description` is needed as objects don't receive perception messages.

### Bug Fix: handle_pick_up_item.rule.json

**Issue:** Missing `target_id` parameter in DISPATCH_PERCEPTIBLE_EVENT

**Fix:** Add `"target_id": "{event.payload.targetId}"` to all DISPATCH_PERCEPTIBLE_EVENT calls in this rule.

### Macro Replacement

**Rules using macro:** All 6 rules use `{ "macro": "core:logSuccessAndEndTurn" }`

**Replace with inline operations:**
```json
[
  {
    "type": "DISPATCH_PERCEPTIBLE_EVENT",
    "parameters": {
      "location_id": "{context.actorPosition.locationId}",
      "description_text": "...",
      "actor_description": "...",
      "alternate_descriptions": {...},
      "perception_type": "action",
      "actor_id": "{event.payload.actorId}",
      "target_id": "{event.payload.targetId}",
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

### 1. handle_open_container.rule.json

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} opens {context.containerName}.",
  "actor_description": "I open {context.containerName}, revealing its contents.",
  "alternate_descriptions": {
    "auditory": "I hear a container being opened nearby.",
    "tactile": "I sense something being unlatched nearby."
  }
}
```

**Upgrade FAILURE (locked):**
```json
{
  "description_text": "{context.actorName} cannot open {context.containerName}. It is locked.",
  "actor_description": "I try to open {context.containerName}, but it is locked.",
  "alternate_descriptions": {
    "auditory": "I hear someone struggling with a lock nearby."
  }
}
```

### 2. handle_put_in_container.rule.json

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} puts {context.itemName} in {context.containerName}.",
  "actor_description": "I place {context.itemName} inside {context.containerName}.",
  "alternate_descriptions": {
    "auditory": "I hear something being placed in a container.",
    "tactile": "I sense items being stored nearby."
  }
}
```

**Upgrade FAILURE (full):**
```json
{
  "description_text": "{context.containerName} is full. {context.actorName} cannot put {context.itemName} in it.",
  "actor_description": "I try to put {context.itemName} in {context.containerName}, but it is full.",
  "alternate_descriptions": {
    "auditory": "I hear a failed attempt to store something."
  }
}
```

### 3. handle_take_from_container.rule.json

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} takes {context.itemName} from {context.containerName}.",
  "actor_description": "I reach into {context.containerName} and take {context.itemName}.",
  "alternate_descriptions": {
    "auditory": "I hear something being removed from a container.",
    "tactile": "I sense items being retrieved nearby."
  }
}
```

**Upgrade FAILURE (inventory full):**
```json
{
  "description_text": "{context.actorName}'s inventory is full. Cannot take {context.itemName}.",
  "actor_description": "I try to take {context.itemName}, but I cannot carry any more.",
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to take something."
  }
}
```

### 4. handle_pick_up_item.rule.json

**Bug Fix:** Add `"target_id": "{event.payload.targetId}"` to all DISPATCH_PERCEPTIBLE_EVENT calls.

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} picks up {context.itemName}.",
  "actor_description": "I pick up {context.itemName} and add it to my inventory.",
  "alternate_descriptions": {
    "auditory": "I hear something being picked up from the ground.",
    "tactile": "I sense someone retrieving an item nearby."
  }
}
```

**Upgrade FAILURE (inventory full):**
```json
{
  "description_text": "{context.actorName}'s inventory is full. Cannot pick up {context.itemName}.",
  "actor_description": "I try to pick up {context.itemName}, but I cannot carry any more.",
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to pick something up."
  }
}
```

### 5. handle_put_on_nearby_surface.rule.json

**Upgrade:**
```json
{
  "description_text": "{context.actorName} puts {context.itemName} on {context.surfaceName}.",
  "actor_description": "I place {context.itemName} on {context.surfaceName}.",
  "alternate_descriptions": {
    "auditory": "I hear something being placed on a surface.",
    "tactile": "I sense an item being set down nearby."
  }
}
```

### 6. handle_take_from_nearby_surface.rule.json

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} takes {context.itemName} from {context.surfaceName}.",
  "actor_description": "I take {context.itemName} from {context.surfaceName}.",
  "alternate_descriptions": {
    "auditory": "I hear something being taken from a surface.",
    "tactile": "I sense an item being retrieved nearby."
  }
}
```

**Upgrade FAILURE (inventory full):**
```json
{
  "description_text": "{context.actorName}'s inventory is full. Cannot take {context.itemName}.",
  "actor_description": "I try to take {context.itemName}, but I cannot carry any more.",
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to take something."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Containers integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/containers/ --no-coverage --silent
   ```

2. **Item-handling integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/item-handling/ --no-coverage --silent
   ```

3. **Item-placement integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/item-placement/ --no-coverage --silent
   ```

4. **Items mod tests (related functionality):**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --silent
   ```

5. **Mod validations:**
   ```bash
   npm run validate:mod:containers
   npm run validate:mod:item-handling
   npm run validate:mod:item-placement
   ```

6. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing container and item handling behavior is preserved
2. Container operations work correctly (open, put_in, take_from)
3. Item pickup and placement work correctly
4. Inventory capacity validation still occurs
5. Container capacity validation still occurs
6. `target_id` is correctly populated in all events (bug fix verified)
7. TURN_ENDED event is dispatched after successful operations
8. Events dispatch with correct payloads
9. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/containers/rules/handle_open_container.rule.json'))" && echo "OK: handle_open_container"
node -e "JSON.parse(require('fs').readFileSync('data/mods/containers/rules/handle_put_in_container.rule.json'))" && echo "OK: handle_put_in_container"
node -e "JSON.parse(require('fs').readFileSync('data/mods/containers/rules/handle_take_from_container.rule.json'))" && echo "OK: handle_take_from_container"
node -e "JSON.parse(require('fs').readFileSync('data/mods/item-handling/rules/handle_pick_up_item.rule.json'))" && echo "OK: handle_pick_up_item"
node -e "JSON.parse(require('fs').readFileSync('data/mods/item-placement/rules/handle_put_on_nearby_surface.rule.json'))" && echo "OK: handle_put_on_nearby_surface"
node -e "JSON.parse(require('fs').readFileSync('data/mods/item-placement/rules/handle_take_from_nearby_surface.rule.json'))" && echo "OK: handle_take_from_nearby_surface"

# 2. Run mod validations
npm run validate:mod:containers
npm run validate:mod:item-handling
npm run validate:mod:item-placement

# 3. Run integration tests
NODE_ENV=test npx jest tests/integration/mods/containers/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/item-handling/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/item-placement/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Testing Scenarios

### Bug Fix Verification
Verify `handle_pick_up_item` events include `target_id`:
1. Pick up item successfully
2. Verify DISPATCH_PERCEPTIBLE_EVENT contains `target_id` in payload
3. Check event tracing/logging for correct target reference

### Container Operations
1. Open unlocked container → success message
2. Open locked container → failure message
3. Put item in container with space → success
4. Put item in full container → failure
5. Take item with inventory space → success
6. Take item with full inventory → failure

### Surface Operations
1. Put item on surface → success
2. Take item with space → success
3. Take item with full inventory → failure

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Macro being replaced: `data/mods/core/macros/logSuccessAndEndTurn.macro.json` (reference only)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
