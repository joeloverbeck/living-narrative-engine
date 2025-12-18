# DISPEREVEUPG-010: Locks & Observation Rules - Perspective Upgrade

**Status:** Completed
**Priority:** Moderate (Priority 3)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 locks and observation rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/locks/rules/handle_lock_connection.rule.json`
- `data/mods/locks/rules/handle_unlock_connection.rule.json`
- `data/mods/observation/rules/handle_examine_item_in_location.rule.json`
- `data/mods/observation/rules/handle_examine_owned_item.rule.json`

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
- Test files (tests will verify behavior, not be modified) - **REVISED**: Tests may require updates per the payload contract spec (see `specs/dispatch-perceptible-event-payload-contract.spec.md`)

---

## Assumption Corrections (Post-Investigation)

### Lock Rules Use `core:logSuccessAndEndTurn` Macro

**Original Assumption:** The success paths use direct `DISPATCH_PERCEPTIBLE_EVENT` operations.

**Actual State:** Both `handle_lock_connection.rule.json` and `handle_unlock_connection.rule.json` use the `core:logSuccessAndEndTurn` macro for their success paths. This macro uses `DISPATCH_EVENT` (not `DISPATCH_PERCEPTIBLE_EVENT`), dispatching a raw `core:perceptible_event` payload without the perspective-aware parameters.

**Resolution:** The success paths must replace the macro with inline `DISPATCH_PERCEPTIBLE_EVENT` operations (following the pattern from `handle_drink_from.rule.json`).

### Failure Branches Exist But Need Enhancement

**Original Assumption:** Not fully specified.

**Actual State:** Failure branches (missing/wrong key, already locked/unlocked) already use `DISPATCH_PERCEPTIBLE_EVENT` but without `log_entry`, `actor_description`, or `alternate_descriptions`.

**Resolution:** Add perspective-aware parameters to existing failure branch `DISPATCH_PERCEPTIBLE_EVENT` operations.

### Observation Rules Use `recipientIds` for Actor-Only Delivery

**Original Assumption:** Standard perception events.

**Actual State:** Both observation rules use `contextual_data.recipientIds: ["{event.payload.actorId}"]` to deliver the perception only to the actor. This is intentional - examination results are private to the examiner.

**Resolution:** Keep `recipientIds` pattern. Add `actor_description` with item details, and `log_entry: true` for perception logging. The `description_text` should remain a brief public-safe message while `actor_description` contains the detailed examination results.

### Observation Rules Include Item Description in descriptionText

**Original Assumption:** The `actor_description` should include item details.

**Actual State:** Current rules include full item description in `descriptionText`. Since `recipientIds` limits delivery to actor only, this is currently fine. However, for perspective-aware logging, we should:
- Keep `description_text` as a brief third-person message (in case recipientIds filtering changes)
- Add `actor_description` with full item description for the actor's perception log

---

## Implementation Details

### Pattern: Object Interaction (Actor + Object)

All four rules involve actor interacting with objects (locks, items). Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, tactile where appropriate)
- `log_entry: true` (to enable perception logging)

No `target_description` is needed as objects don't receive perception messages.

### 1. handle_lock_connection.rule.json

**Current State:**
- Failure branches use `DISPATCH_PERCEPTIBLE_EVENT` without perspective params
- Success branch uses `core:logSuccessAndEndTurn` macro (must be replaced)

**Upgrade SUCCESS (replace macro):**

The success path currently uses `core:logSuccessAndEndTurn` macro. Replace with inline operations:

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Lock action with perspective-aware descriptions",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} locks {context.targetName} with {context.keyName}.",
    "actor_description": "I lock {context.targetName} with {context.keyName}, securing it with a click.",
    "perception_type": "connection.lock",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear the click of a lock engaging nearby.",
      "tactile": "I sense the vibration of a mechanism locking."
    }
  }
}
```

Followed by:
```json
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "core:display_successful_action_result",
    "payload": {
      "message": "{context.logMessage}"
    }
  }
},
{
  "type": "END_TURN",
  "parameters": {
    "entityId": "{event.payload.actorId}",
    "success": true
  }
}
```

**Upgrade FAILURE (missing/wrong key) - enhance existing:**
```json
{
  "description_text": "{context.logMessage}",
  "actor_description": "I try to lock {target}, but I don't have the matching key.",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to lock something."
  }
}
```

**Upgrade FAILURE (already locked) - enhance existing:**
```json
{
  "description_text": "{context.logMessage}",
  "actor_description": "I check {target}, but it's already locked.",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear someone checking a lock nearby."
  }
}
```

### 2. handle_unlock_connection.rule.json

**Current State:** Same as lock - macro for success, basic DISPATCH_PERCEPTIBLE_EVENT for failures.

**Upgrade SUCCESS (replace macro):**

Replace `core:logSuccessAndEndTurn` with inline operations:

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Unlock action with perspective-aware descriptions",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} unlocks {context.targetName} with {context.keyName}.",
    "actor_description": "I unlock {context.targetName} with {context.keyName}, feeling the mechanism release.",
    "perception_type": "connection.unlock",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear the click of a lock disengaging nearby.",
      "tactile": "I sense the vibration of a mechanism unlocking."
    }
  }
}
```

Followed by `DISPATCH_EVENT` for success message and `END_TURN`.

**Upgrade FAILURE (missing/wrong key) - enhance existing:**
```json
{
  "description_text": "{context.logMessage}",
  "actor_description": "I try to unlock {target}, but I don't have the matching key.",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to unlock something."
  }
}
```

**Upgrade FAILURE (already unlocked) - enhance existing:**
```json
{
  "description_text": "{context.logMessage}",
  "actor_description": "I check {target}, but it's already unlocked.",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear someone checking a lock nearby."
  }
}
```

### 3. handle_examine_item_in_location.rule.json

**Current State:** Uses `DISPATCH_PERCEPTIBLE_EVENT` directly with `recipientIds` to deliver only to actor.

**Upgrade:**

Keep existing structure but add perspective parameters:

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Log examination with full description for actor only",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} examines {context.itemName}.",
    "actor_description": "I examine {context.itemName} closely: {context.itemDescription.text}",
    "perception_type": "item.examine",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear someone inspecting something nearby."
    },
    "contextual_data": {
      "recipientIds": ["{event.payload.actorId}"]
    }
  }
}
```

Note: Item description moves from `description_text` to `actor_description` where it belongs (private to actor).

### 4. handle_examine_owned_item.rule.json

**Current State:** Same as examine_item_in_location.

**Upgrade:**

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Log examination with full description for actor only",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} examines their {context.itemName}.",
    "actor_description": "I examine {context.itemName} that I'm carrying: {context.itemDescription.text}",
    "perception_type": "item.examine",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear someone inspecting an item they're holding."
    },
    "contextual_data": {
      "recipientIds": ["{event.payload.actorId}"]
    }
  }
}
```

---

## Test Impact Assessment

### Per `specs/dispatch-perceptible-event-payload-contract.spec.md`:

The payload contract specifies that `actor_description`, `alternate_descriptions`, and `log_entry` are **NOT included in the event payload**. Tests should:

1. **NOT assert** on `payload.actorDescription`, `payload.alternateDescriptions`, or `payload.logEntry`
2. **DO assert** on `payload.contextualData.skipRuleLogging` which reflects the `log_entry` value
3. **DO assert** on observable payload fields: `descriptionText`, `actorId`, `targetId`, `perceptionType`, `locationId`

### Existing Tests Analysis:

**Locks tests (`lock_rule.integration.test.js`, `unlock_rule.integration.test.js`):**
- Assert on `perceptionType` and `descriptionText` ✓
- Don't assert on internal fields ✓
- **Impact:** `descriptionText` will change from `"{actor} locks {target} with {key}."` to same - no change needed

**Observation tests (`examineItemInLocationRuleExecution.test.js`, `examineOwnedItemRuleExecution.test.js`):**
- Assert on `descriptionText` containing item description ✓
- **Impact:** `descriptionText` will change from including item description to NOT including it (item description moves to `actor_description`). **Tests must be updated.**

---

## Acceptance Criteria

### Tests That Must Pass

1. **Locks integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/locks/ --no-coverage --silent
   ```

2. **Observation integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/observation/ --no-coverage --silent
   ```

3. **Mod validations:**
   ```bash
   npm run validate:mod:locks
   npm run validate:mod:observation
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing locks and observation behavior is preserved
2. Lock/unlock mechanics work correctly (state changes applied)
3. Key requirement validation still occurs
4. Examination mechanics work correctly (item details revealed)
5. Events dispatch with correct payloads (per payload contract spec)
6. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/locks/rules/handle_lock_connection.rule.json'))" && echo "OK: handle_lock_connection"
node -e "JSON.parse(require('fs').readFileSync('data/mods/locks/rules/handle_unlock_connection.rule.json'))" && echo "OK: handle_unlock_connection"
node -e "JSON.parse(require('fs').readFileSync('data/mods/observation/rules/handle_examine_item_in_location.rule.json'))" && echo "OK: handle_examine_item_in_location"
node -e "JSON.parse(require('fs').readFileSync('data/mods/observation/rules/handle_examine_owned_item.rule.json'))" && echo "OK: handle_examine_owned_item"

# 2. Run mod validations
npm run validate:mod:locks
npm run validate:mod:observation

# 3. Run integration tests
NODE_ENV=test npx jest tests/integration/mods/locks/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/observation/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
- Payload contract: `specs/dispatch-perceptible-event-payload-contract.spec.md` (test guidance)

---

## Outcome

**Completion Date:** 2025-12-18

### Changes Made

#### Rule Files Modified (4)

1. **`data/mods/locks/rules/handle_lock_connection.rule.json`**
   - Replaced `core:logSuccessAndEndTurn` macro with inline `DISPATCH_PERCEPTIBLE_EVENT` + `DISPATCH_EVENT` + `END_TURN`
   - Added `actor_description`, `log_entry: true`, `alternate_descriptions` (auditory, tactile) to success path
   - Enhanced failure branches (missing/wrong key, already locked) with perspective-aware parameters

2. **`data/mods/locks/rules/handle_unlock_connection.rule.json`**
   - Same changes as lock rule
   - Added `actor_description`, `log_entry: true`, `alternate_descriptions` to all DISPATCH_PERCEPTIBLE_EVENT operations

3. **`data/mods/observation/rules/handle_examine_item_in_location.rule.json`**
   - Changed `description_text` from including item description to brief third-person message: `"{actorName} examines {itemName}."`
   - Added `actor_description` with detailed item info: `"I examine {itemName} closely: {itemDescription.text}"`
   - Added `log_entry: true` and `alternate_descriptions` (auditory)

4. **`data/mods/observation/rules/handle_examine_owned_item.rule.json`**
   - Same pattern with possessive language: `"{actorName} examines their {itemName}."`
   - `actor_description`: `"I examine {itemName} that I'm carrying: {itemDescription.text}"`

#### Test Files Modified (2)

Per `specs/dispatch-perceptible-event-payload-contract.spec.md`, tests were updated because item description moved from `descriptionText` (in payload) to `actor_description` (not in payload):

1. **`tests/integration/mods/observation/examineItemInLocationRuleExecution.test.js`**
   - Updated 6 assertions to expect brief third-person message without item description
   - Added comments referencing payload contract spec

2. **`tests/integration/mods/observation/examineOwnedItemRuleExecution.test.js`**
   - Updated 5 assertions to expect brief third-person message without item description
   - Added comments referencing payload contract spec

### Tests Summary

| Test Suite | Tests | Status |
|------------|-------|--------|
| `tests/integration/mods/locks/` | 6 | ✅ Pass |
| `tests/integration/mods/observation/` | 65 | ✅ Pass |

### Rationale for Test Updates

The observation tests asserted that `descriptionText` contained the full item description (e.g., `"Alice examines their letter-1: A weathered letter."`). With the perspective-aware upgrade, item descriptions moved to `actor_description` which per the payload contract spec is NOT included in the event payload. Tests now expect only the brief third-person message (e.g., `"Alice examines their letter-1."`).

This aligns with the design principle that `descriptionText` is the public-safe message while `actor_description` contains private first-person perception details consumed internally by the perception logging system.
