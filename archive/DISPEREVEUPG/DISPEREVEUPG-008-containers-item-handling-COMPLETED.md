# DISPEREVEUPG-008: Containers, Item-Handling, Item-Placement - Perspective Upgrade + Bug Fix + Macro Replacement

**Status:** Completed
**Priority:** Moderate (Priority 3)
**Estimated Effort:** 1 day
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 6 container and item handling rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`. Reality check on current code/tests:

- Only the **success branches** still use the `core:logSuccessAndEndTurn` macro; the failure branches already dispatch perceptible events inline (but without perspective fields).
- `handle_pick_up_item.rule.json` is missing `target_id` only on the **failure** perceptible event; success sets `targetId` for the macro context.
- Relevant integration coverage for these rules lives under `tests/integration/mods/items/` and `tests/integration/mods/item-placement/`; there is no `tests/integration/mods/containers/` folder.

This ticket also includes:
1. **Bug fix**: Add missing `target_id` parameter on the failed pickup perceptible event.
2. **Macro replacement (success paths only)**: Replace `core:logSuccessAndEndTurn` with inline operations that keep the same third-person messages, add perspective fields, and still dispatch the display + action success events before ending the turn.

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
- The macro definition itself (`core:logSuccessAndEndTurn`)

**Tests:** Adjust or add focused integration tests only if needed to cover perspective fields or the `target_id` bug fix.

---

## Implementation Details

### Pattern: Object Interaction (Actor + Object)

All six rules involve an actor interacting with objects (containers, items, surfaces). Each DISPATCH_PERCEPTIBLE_EVENT should:
- Include `actor_description` (first-person) and `alternate_descriptions` (auditory, tactile where appropriate).
- Set `log_entry: true` so perspective-aware data is available to perception logs.
- Preserve existing `perception_type` values and observer-facing `description_text` to avoid breaking current assertions.
- Keep `target_id` populated for object targets.

No `target_description` is needed because these interactions do not message another actor.

### Bug Fix: handle_pick_up_item.rule.json

**Issue:** Failure perceptible event omits `target_id`.

**Fix:** Add `"target_id": "{event.payload.targetId}"` to the failure branch dispatch and carry it through the upgraded success dispatch.

### Macro Replacement

**Rules using macro:** The success branches in all 6 rules end with `{ "macro": "core:logSuccessAndEndTurn" }`.

**Replace success macro usage with inline operations that:**
- Dispatch `DISPATCH_PERCEPTIBLE_EVENT` with perspective-aware fields and `log_entry: true`.
- Dispatch `core:display_successful_action_result` and `core:action_success` with the same message payload the macro emitted.
- End the turn with `END_TURN` (success: true).

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
    "auditory": "I hear something being removed from a container."
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

1. **Item + container handling integration tests (existing coverage lives under items):**
   ```bash
   NODE_ENV=test npx jest \
     tests/integration/mods/items/pickUpItemRuleExecution.test.js \
     tests/integration/mods/items/openContainerRuleExecution.test.js \
     tests/integration/mods/items/putInContainerRuleExecution.test.js \
     tests/integration/mods/items/takeFromContainerRuleExecution.test.js \
     --no-coverage --silent
   ```

2. **Item-placement integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/item-placement/ --no-coverage --silent
   ```

3. **Items mod regression sweep (optional if time permits):**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --silent
   ```

4. **Mod validations:**
   ```bash
   npm run validate:mod -- --mod containers --mod item-handling --mod item-placement
   ```

5. **Full test suite:**
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

## Outcome

- Adjusted assumptions: only success branches were macro-based; `target_id` was missing solely on the failed pickup dispatch; relevant integration coverage lives under `tests/integration/mods/items/` and `tests/integration/mods/item-placement/`.
- Added perspective-aware `actor_description`, `alternate_descriptions`, and `log_entry: true` to all six rules’ perceptible events (success + failure as applicable); fixed `target_id` on pickup failure; replaced success macros with inline DISPATCH_PERCEPTIBLE_EVENT + UI/action success + END_TURN sequences while preserving existing messages and perception types.
- Tests executed: `NODE_ENV=test npx jest tests/integration/mods/items/pickUpItemRuleExecution.test.js tests/integration/mods/items/openContainerRuleExecution.test.js tests/integration/mods/items/putInContainerRuleExecution.test.js tests/integration/mods/items/takeFromContainerRuleExecution.test.js --runInBand --no-coverage`; `NODE_ENV=test npx jest tests/integration/mods/item-placement/ --runInBand --no-coverage`; `npm run validate:mod -- --mod containers --mod item-handling --mod item-placement`.

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Macro being replaced: `data/mods/core/macros/logSuccessAndEndTurn.macro.json` (reference only)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
