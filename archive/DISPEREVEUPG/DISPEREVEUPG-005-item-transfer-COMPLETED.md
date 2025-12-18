# DISPEREVEUPG-005: Item Transfer Rule - Perspective Upgrade + Macro Replacement

**Status:** Completed
**Priority:** Critical (Priority 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the `handle_give_item` rule to support perspective-aware perception with `actor_description`, `target_description`, and `alternate_descriptions`. This ticket also requires **replacing the macro** `core:logSuccessAndEndTurn` with inline operations for complete perspective support **while preserving the existing UI success events and turn flow that the macro emits**.

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
- The macro definition itself (`core:logSuccessAndEndTurn`)

**Tests may be added** if needed to cover the new perspective-aware fields or regressions exposed by this work.

---

## Implementation Details

### Pattern: Actor-to-Actor Action (Full Perspective)

This rule involves actor giving item to target. Both are actors requiring full perspective support.

### Macro Replacement

**Current uses:** `{ "macro": "core:logSuccessAndEndTurn" }`

**Replace with inline operations that preserve macro behavior:**
- Use `{event.payload.targetId}` for the recipient (primary target) and `{event.payload.secondaryId}` for the item.
- Emit a perspective-aware `DISPATCH_PERCEPTIBLE_EVENT` with `log_entry: true`, `actor_description`, `target_description`, and `alternate_descriptions`.
- Preserve the UI and analytics events the macro produced:
  - `core:display_successful_action_result` (message identical to `description_text`)
  - `core:action_success` with `{event.payload.actionId, actorId, targetId}`
- End the turn via `END_TURN` (which already dispatches `core:turn_ended`); no extra TURN_ENDED dispatch is needed.

### handle_give_item.rule.json

**Current:** Uses macro for success path (which dispatches `core:perceptible_event`, `core:display_successful_action_result`, `core:action_success`, and ends the turn). Failure path already dispatches a perceptible event but lacks perspective fields.

**Upgrade SUCCESS path:**
- Keep the existing transfer and regeneration steps.
- Emit `DISPATCH_PERCEPTIBLE_EVENT` with:
  - `location_id`: `{context.actorPosition.locationId}`
  - `description_text`: `{context.actorName} gives {context.itemName} to {context.targetName}.`
  - `actor_description`: `I hand {context.itemName} to {context.targetName}.`
  - `target_description`: `{context.actorName} gives me {context.itemName}.`
  - `perception_type`: `item.transfer`
  - `actor_id`: `{event.payload.actorId}`
  - `target_id`: `{event.payload.targetId}` (recipient)
  - `log_entry`: true
  - `alternate_descriptions`: `{ "auditory": "I hear something being handed over nearby." }`
- Follow with:
  - `DISPATCH_EVENT` -> `core:display_successful_action_result` (message matches `description_text`)
  - `DISPATCH_EVENT` -> `core:action_success` with `{event.payload.actionId, event.payload.actorId, event.payload.targetId, success: true}`
  - `END_TURN` with `success: true`

**Upgrade FAILURE path (capacity exceeded):**
- Use `{event.payload.targetId}` for the recipient and keep `{event.payload.secondaryId}` for the item entity.
- Emit `DISPATCH_PERCEPTIBLE_EVENT` with perspective fields and `log_entry: true`:
  - `description_text`: `{context.targetName}'s inventory is full. {context.actorName} cannot give {context.itemName}.`
  - `actor_description`: `I try to give {context.itemName} to {context.targetName}, but their inventory is full.`
  - `target_description`: `{context.actorName} tries to give me {context.itemName}, but I cannot carry any more.`
  - `perception_type`: `error.action_failed`
  - `alternate_descriptions.auditory`: `I hear a failed attempt to transfer something.`
- Keep the existing failed action display and turn ending behavior.

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
   npm run validate:mod -- --mod=item-transfer
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
npm run validate:mod -- --mod=item-transfer

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

## Outcome

- Replaced `core:logSuccessAndEndTurn` usage in `handle_give_item` with inline operations while preserving the macro's UI events (`core:display_successful_action_result`, `core:action_success`) and turn ending behavior.
- Added perspective-aware `actor_description`, `target_description`, and `alternate_descriptions` to both success and capacity-failure perceptible events with `log_entry: true`.
- Corrected mod validation command to `npm run validate:mod -- --mod=item-transfer` (the per-mod script name in the ticket did not exist).
- Added an integration test to assert the perceptible event `targetId` points to the recipient (not the item) on success.

---

## Reference Files

- Pattern to follow: `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` (full actor/target/alternates per outcome)
- Macro being replaced: `data/mods/core/macros/logSuccessAndEndTurn.macro.json` (reference only)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
